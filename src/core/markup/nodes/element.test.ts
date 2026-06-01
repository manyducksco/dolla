import { describe, expect, test, vi } from "vitest";
import { createContext } from "../../context.js";
import { createAtom } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { ElementNode } from "./element.js";
import { createMarkup } from "../utils.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

describe("ElementNode", () => {
  describe("creation and basic lifecycle", () => {
    test("creates an element with the given tag", () => {
      const { context } = setup();
      const node = new ElementNode(context, "div", {});
      expect(node.getRoot()).toBeInstanceOf(HTMLDivElement);
    });

    test("creates a span element", () => {
      const { context } = setup();
      const node = new ElementNode(context, "span", {});
      expect(node.getRoot()).toBeInstanceOf(HTMLSpanElement);
    });

    test("isMounted returns false before mounting", () => {
      const { context } = setup();
      const node = new ElementNode(context, "div", {});
      expect(node.isMounted()).toBe(false);
    });

    test("mount appends element to parent", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "p", { children: "hello" });
      node.mount(container);
      expect(node.isMounted()).toBe(true);
      expect(container.childNodes.length).toBe(1);
      expect(container.children[0].tagName).toBe("P");
    });

    test("mount with after positions as next sibling", () => {
      const { context, container } = setup();
      const first = new ElementNode(context, "span", { children: "1" });
      const second = new ElementNode(context, "span", { children: "2" });
      first.mount(container);
      second.mount(container, first.getRoot());
      expect(container.children[0].textContent).toBe("1");
      expect(container.children[1].textContent).toBe("2");
    });

    test("mounting a second time to a different parent moves the element", () => {
      const { context, container } = setup();
      const other = document.createElement("div");
      const node = new ElementNode(context, "span", { children: "move" });
      node.mount(container);
      expect(container.children.length).toBe(1);
      node.mount(other);
      expect(container.children.length).toBe(0);
      expect(other.children.length).toBe(1);
    });

    test("getRoot returns the root DOM element", () => {
      const { context } = setup();
      const node = new ElementNode(context, "div", {});
      expect(node.getRoot()).toBeInstanceOf(HTMLElement);
    });
  });

  describe("unmount", () => {
    test("unmount removes element from parent", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {});
      node.mount(container);
      node.unmount();
      expect(container.children.length).toBe(0);
      expect(node.isMounted()).toBe(false);
    });

    test("unmount with skipDOM does not remove element from DOM", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {});
      node.mount(container);
      node.unmount(true);
      expect(container.children.length).toBe(1);
      expect(node.getRoot()?.parentNode).toBe(container);
    });

    test("unmounting an unmounted node does not throw", () => {
      const { context } = setup();
      const node = new ElementNode(context, "div", {});
      expect(() => node.unmount()).not.toThrow();
    });
  });

  describe("children", () => {
    test("renders a single child node", () => {
      const { context, container } = setup();
      const child = new ElementNode(context, "span", { children: "text" });
      const node = new ElementNode(context, "div", { children: child });
      node.mount(container);
      expect(container.children[0].children.length).toBe(1);
      expect(container.children[0].children[0].tagName).toBe("SPAN");
    });

    test("renders multiple children as an array", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "ul", {
        children: [
          new ElementNode(context, "li", { children: "A" }),
          new ElementNode(context, "li", { children: "B" }),
          new ElementNode(context, "li", { children: "C" }),
        ],
      });
      node.mount(container);
      const ul = container.children[0];
      expect(ul.children.length).toBe(3);
      expect(ul.children[0].textContent).toBe("A");
      expect(ul.children[1].textContent).toBe("B");
      expect(ul.children[2].textContent).toBe("C");
    });

    test("renders text children", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "p", { children: "Hello World" });
      node.mount(container);
      expect(container.children[0].textContent).toBe("Hello World");
    });
  });

  describe("attributes", () => {
    test("sets static string attributes", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "a", { href: "/test", title: "link" });
      node.mount(container);
      const el = container.children[0] as HTMLAnchorElement;
      expect(el.getAttribute("href")).toBe("/test");
      expect(el.getAttribute("title")).toBe("link");
    });

    test("sets the 'for' attribute as htmlFor property", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "label", { for: "input-id" });
      node.mount(container);
      const el = container.children[0] as HTMLLabelElement;
      expect(el.htmlFor).toBe("input-id");
    });

    test("sets boolean properties like checked", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "input", { type: "checkbox", checked: true });
      node.mount(container);
      const el = container.children[0] as HTMLInputElement;
      expect(el.checked).toBe(true);
    });

    test("sets falsy boolean properties", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "input", { type: "checkbox", checked: false });
      node.mount(container);
      const el = container.children[0] as HTMLInputElement;
      expect(el.checked).toBe(false);
    });

    test("sets attributes via attr: prefix", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "attr:data-value": "42" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("data-value")).toBe("42");
    });

    test("sets attributes via : prefix shorthand", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { ":aria-label": "close" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-label")).toBe("close");
    });

    test("sets properties via prop: prefix", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "prop:innerHTML": "<span>hello</span>" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.innerHTML).toBe("<span>hello</span>");
    });

    test("sets properties via . prefix shorthand", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { ".innerHTML": "<span>hello</span>" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.innerHTML).toBe("<span>hello</span>");
    });

    test("removes attribute when value is falsy", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "data-test": "visible" });
      node.mount(container);
      expect(container.children[0].hasAttribute("data-test")).toBe(true);
      const node2 = new ElementNode(context, "div", { "data-test": "" });
      const c2 = document.createElement("div");
      node2.mount(c2);
      expect(c2.children[0].hasAttribute("data-test")).toBe(false);
    });
  });

  describe("reactive attributes via signals", () => {
    test("updates attribute when signal changes", () => {
      const { context, container } = setup();
      const [href, setHref] = createAtom("/initial");
      const node = new ElementNode(context, "a", { href });
      node.mount(container);
      const el = container.children[0] as HTMLAnchorElement;
      expect(el.getAttribute("href")).toBe("/initial");
      setHref("/updated");
      flushPendingUpdates();
      expect(el.getAttribute("href")).toBe("/updated");
    });

    test("removes attribute when signal becomes empty", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom("hello");
      const node = new ElementNode(context, "div", { "data-test": val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.hasAttribute("data-test")).toBe(true);
      setVal("");
      flushPendingUpdates();
      expect(el.hasAttribute("data-test")).toBe(false);
    });
  });

  describe("classes", () => {
    test("sets classes via string", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { class: "foo bar" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("foo")).toBe(true);
      expect(el.classList.contains("bar")).toBe(true);
    });

    test("sets classes via className", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { className: "foo bar" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("foo")).toBe(true);
      expect(el.classList.contains("bar")).toBe(true);
    });

    test("sets classes via object", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        class: { foo: true, bar: false, baz: true },
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("foo")).toBe(true);
      expect(el.classList.contains("bar")).toBe(false);
      expect(el.classList.contains("baz")).toBe(true);
    });

    test("sets classes via array", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        class: ["foo", { bar: true, baz: false }],
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("foo")).toBe(true);
      expect(el.classList.contains("bar")).toBe(true);
      expect(el.classList.contains("baz")).toBe(false);
    });

    test("reactively toggles class via signal in object", () => {
      const { context, container } = setup();
      const [isActive, setIsActive] = createAtom(true);
      const node = new ElementNode(context, "div", { class: { active: isActive } });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("active")).toBe(true);
      setIsActive(false);
      flushPendingUpdates();
      expect(el.classList.contains("active")).toBe(false);
    });

    test("reactively swaps class object via signal", () => {
      const { context, container } = setup();
      const [classes, setClasses] = createAtom({ foo: true, bar: false });
      const node = new ElementNode(context, "div", { class: classes });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("foo")).toBe(true);
      expect(el.classList.contains("bar")).toBe(false);
      setClasses({ foo: false, bar: true });
      flushPendingUpdates();
      expect(el.classList.contains("foo")).toBe(false);
      expect(el.classList.contains("bar")).toBe(true);
    });
  });

  describe("styles", () => {
    test("sets styles via string", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { style: "color: red; font-size: 16px" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("red");
      expect(el.style.fontSize).toBe("16px");
    });

    test("sets styles via object", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        style: { color: "blue", fontSize: "14px" },
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("blue");
      expect(el.style.fontSize).toBe("14px");
    });

    test("appends px to numeric values for length-based properties", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        style: { width: 100, height: 50, opacity: 0.5, zIndex: 10 },
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.width).toBe("100px");
      expect(el.style.height).toBe("50px");
      expect(el.style.opacity).toBe("0.5");
      expect(el.style.zIndex).toBe("10");
    });

    test("reactively updates style via signal in object", () => {
      const { context, container } = setup();
      const [color, setColor] = createAtom("red");
      const node = new ElementNode(context, "div", { style: { color } });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("red");
      setColor("green");
      flushPendingUpdates();
      expect(el.style.color).toBe("green");
    });

    test("reactively swaps style object via signal", () => {
      const { context, container } = setup();
      const [styles, setStyles] = createAtom({ color: "red", fontSize: "12px" });
      const node = new ElementNode(context, "div", { style: styles });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("red");
      expect(el.style.fontSize).toBe("12px");
      setStyles({ color: "blue", fontSize: "16px" });
      flushPendingUpdates();
      expect(el.style.color).toBe("blue");
      expect(el.style.fontSize).toBe("16px");
    });

    test("handles CSS values containing colons (e.g. url())", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        style: "background: url('https://example.com/image.jpg')",
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.background).toContain('url("https://example.com/image.jpg")');
    });

    test("parses !important from inline style string", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        style: "color: red !important",
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("red");
      expect(el.style.getPropertyPriority("color")).toBe("important");
    });

    test("does not strip !important from content values", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        style: 'content: "!important"',
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.content).toBe('"!important"');
    });

    test("handles multiple inline styles with urls and !important", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        style: "color: red !important; background: url('https://example.com/bg.png')",
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("red");
      expect(el.style.getPropertyPriority("color")).toBe("important");
      expect(el.style.background).toContain('url("https://example.com/bg.png")');
    });

    test("skips inline style entries without colon", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { style: "color: red; invalid" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.style.color).toBe("red");
    });
  });

  describe("events", () => {
    test("handles onEvent convention (onClick)", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { onClick: handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("handles @event convention (@click)", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { "@click": handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("unsubscribes event listeners on unmount", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { onClick: handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
      node.unmount();
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("ref", () => {
    test("calls ref with the DOM element on mount", () => {
      const { context, container } = setup();
      const ref = vi.fn();
      const node = new ElementNode(context, "div", { ref });
      node.mount(container);
      expect(ref).toHaveBeenCalledTimes(1);
      expect(ref).toHaveBeenCalledWith(node.getRoot());
    });

    test("calls ref cleanup on unmount", () => {
      const { context, container } = setup();
      const cleanup = vi.fn();
      const ref = vi.fn(() => cleanup);
      const node = new ElementNode(context, "div", { ref });
      node.mount(container);
      expect(ref).toHaveBeenCalledTimes(1);
      node.unmount();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("SVG", () => {
    test("creates svg root in SVG namespace", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "svg", {});
      node.mount(container);
      expect(container.children[0].namespaceURI).toBe("http://www.w3.org/2000/svg");
    });

    test("nested elements inside svg use SVG namespace", () => {
      const { context, container } = setup();
      const svg = new ElementNode(context, "svg", {
        children: createMarkup("g", {
          children: createMarkup("rect", { width: 100, height: 50 }),
        }),
      });
      svg.mount(container);
      const rect = container.querySelector("rect")!;
      expect(rect.namespaceURI).toBe("http://www.w3.org/2000/svg");
    });

    test("foreignObject exits SVG namespace for its children", () => {
      const { context, container } = setup();
      const svg = new ElementNode(context, "svg", {
        children: createMarkup("foreignObject", {
          children: createMarkup("div", { children: "hello" }),
        }),
      });
      svg.mount(container);
      const div = container.querySelector("div")!;
      expect(div.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
    });
  });

  describe("move", () => {
    test("move repositions element after the target", () => {
      const { context, container } = setup();
      const first = new ElementNode(context, "span", { children: "1" });
      const second = new ElementNode(context, "span", { children: "2" });
      const third = new ElementNode(context, "span", { children: "3" });
      first.mount(container);
      second.mount(container);
      third.mount(container);
      expect(container.children[0].textContent).toBe("1");
      expect(container.children[2].textContent).toBe("3");

      third.move(container, first.getRoot());
      expect(container.children[0].textContent).toBe("1");
      expect(container.children[1].textContent).toBe("3");
      expect(container.children[2].textContent).toBe("2");
    });
  });

  describe("error cases", () => {
    test("throws on whitespace-only class string", () => {
      const { context } = setup();
      expect(() => new ElementNode(context, "div", { class: " " })).toThrow(
        "Empty class string will cause a DOMException.",
      );
    });

    test("throws on whitespace-only className string", () => {
      const { context } = setup();
      expect(() => new ElementNode(context, "div", { className: " " })).toThrow(
        "Empty class string will cause a DOMException.",
      );
    });
  });

  describe("subscription cleanup", () => {
    test("reactive subscriptions are cleaned up on unmount", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom("a");
      const node = new ElementNode(context, "div", { title: val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("title")).toBe("a");
      node.unmount();
      expect(() => setVal("b")).not.toThrow();
    });
  });


});
