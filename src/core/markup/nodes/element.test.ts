import { describe, expect, test, vi } from "vitest";
import { createContext } from "../../context.js";
import { createAtom } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { css } from "../css.js";
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
      const node = new ElementNode(context, "div", { "prop:innerHTML": "<span>hello</span>" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.innerHTML).toBe("<span>hello</span>");
    });

    test("removes attribute when value is null or undefined", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "data-test": null });
      node.mount(container);
      expect(container.children[0].hasAttribute("data-test")).toBe(false);
      const node2 = new ElementNode(context, "div", { "data-test": undefined });
      const c2 = document.createElement("div");
      node2.mount(c2);
      expect(c2.children[0].hasAttribute("data-test")).toBe(false);
    });

    test("does not render reflected attributes when value is undefined", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { id: undefined, title: undefined });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.hasAttribute("id")).toBe(false);
      expect(el.hasAttribute("title")).toBe(false);
      expect(el.getAttribute("id")).not.toBe("undefined");
      expect(el.getAttribute("title")).not.toBe("undefined");
    });

    test("does not render reflected attributes when value is null", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { id: null, title: null });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.hasAttribute("id")).toBe(false);
      expect(el.hasAttribute("title")).toBe(false);
    });

    test("does not render name attribute when value is undefined", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "input", { name: undefined });
      node.mount(container);
      const el = container.children[0] as HTMLInputElement;
      expect(el.hasAttribute("name")).toBe(false);
      expect(el.getAttribute("name")).not.toBe("undefined");
    });

    test("does not render for attribute when value is undefined", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "label", { for: undefined });
      node.mount(container);
      const el = container.children[0] as HTMLLabelElement;
      expect(el.hasAttribute("for")).toBe(false);
      expect(el.getAttribute("for")).not.toBe("undefined");
    });

    test("does not render for attribute when value is null", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "label", { for: null });
      node.mount(container);
      const el = container.children[0] as HTMLLabelElement;
      expect(el.hasAttribute("for")).toBe(false);
    });

    test("removes reflected attribute when prop: value becomes nullish", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "prop:dataThing": undefined } as any);
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.hasAttribute("dataThing")).toBe(false);
    });

    test("sets attribute to string value for falsy but non-null values", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { tabindex: 0 });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("tabindex")).toBe("0");
    });

    test("sets attribute to empty string for title=\"\"", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { title: "" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("title")).toBe("");
    });

    test("sets aria-hidden to \"false\" string when passed false", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "aria-hidden": false });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-hidden")).toBe("false");
    });

    test("sets aria-hidden to \"true\" string when passed true", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "aria-hidden": true });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-hidden")).toBe("true");
    });

    test("sets ariaLabel via camelCase and converts to kebab-case attribute", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { ariaLabel: "close" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-label")).toBe("close");
    });

    test("sets aria-label via kebab-case", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "aria-label": "close" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-label")).toBe("close");
    });

    test("sets aria-pressed to \"mixed\"", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { "aria-pressed": "mixed" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-pressed")).toBe("mixed");
    });

    test("sets ariaDescribedBy via camelCase and converts to kebab-case attribute", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", { ariaDescribedBy: "desc-id" });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-describedby")).toBe("desc-id");
    });

    test("boolean aria attributes render true as \"true\" and false as \"false\"", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        "aria-hidden": true,
        "aria-disabled": false,
        "aria-checked": true,
        "aria-expanded": false,
        "aria-pressed": true,
        "aria-selected": false,
        "aria-busy": true,
        "aria-readonly": false,
        "aria-required": true,
        "aria-modal": false,
        "aria-multiline": true,
        "aria-multiselectable": false,
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("aria-hidden")).toBe("true");
      expect(el.getAttribute("aria-disabled")).toBe("false");
      expect(el.getAttribute("aria-checked")).toBe("true");
      expect(el.getAttribute("aria-expanded")).toBe("false");
      expect(el.getAttribute("aria-pressed")).toBe("true");
      expect(el.getAttribute("aria-selected")).toBe("false");
      expect(el.getAttribute("aria-busy")).toBe("true");
      expect(el.getAttribute("aria-readonly")).toBe("false");
      expect(el.getAttribute("aria-required")).toBe("true");
      expect(el.getAttribute("aria-modal")).toBe("false");
      expect(el.getAttribute("aria-multiline")).toBe("true");
      expect(el.getAttribute("aria-multiselectable")).toBe("false");
    });

    test("boolean aria attributes remove attribute when value is null or undefined", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "div", {
        "aria-hidden": null,
        "aria-disabled": undefined,
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.hasAttribute("aria-hidden")).toBe(false);
      expect(el.hasAttribute("aria-disabled")).toBe(false);
    });

    test("boolean property disabled={false} removes the disabled attribute", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "button", { disabled: false });
      node.mount(container);
      const el = container.children[0] as HTMLButtonElement;
      expect(el.disabled).toBe(false);
      expect(el.hasAttribute("disabled")).toBe(false);
    });

    test("boolean property disabled={true} sets the disabled attribute", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "button", { disabled: true });
      node.mount(container);
      const el = container.children[0] as HTMLButtonElement;
      expect(el.disabled).toBe(true);
      expect(el.hasAttribute("disabled")).toBe(true);
    });

    test("boolean property disabled={null} removes the disabled attribute", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "button", { disabled: null } as any);
      node.mount(container);
      const el = container.children[0] as HTMLButtonElement;
      expect(el.disabled).toBe(false);
      expect(el.hasAttribute("disabled")).toBe(false);
    });

    test("boolean property disabled={undefined} removes the disabled attribute", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "button", { disabled: undefined });
      node.mount(container);
      const el = container.children[0] as HTMLButtonElement;
      expect(el.disabled).toBe(false);
      expect(el.hasAttribute("disabled")).toBe(false);
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

    test("removes attribute when signal becomes null", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom<string | null>("hello");
      const node = new ElementNode(context, "div", { "data-test": val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.hasAttribute("data-test")).toBe(true);
      setVal(null);
      flushPendingUpdates();
      expect(el.hasAttribute("data-test")).toBe(false);
    });

    test("sets attribute to \"0\" when signal becomes 0", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom<string | number>("text");
      const node = new ElementNode(context, "div", { "data-test": val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      setVal(0);
      flushPendingUpdates();
      expect(el.getAttribute("data-test")).toBe("0");
    });

    test("sets attribute to \"\" when signal becomes empty string", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom("text");
      const node = new ElementNode(context, "div", { "data-test": val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      setVal("");
      flushPendingUpdates();
      expect(el.getAttribute("data-test")).toBe("");
    });

    test("removes reflected attribute when signal becomes undefined", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom<string | undefined>("hello");
      const node = new ElementNode(context, "div", { id: val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("id")).toBe("hello");
      setVal(undefined);
      flushPendingUpdates();
      expect(el.hasAttribute("id")).toBe(false);
    });

    test("removes reflected attribute when signal becomes null", () => {
      const { context, container } = setup();
      const [val, setVal] = createAtom<string | null>("hello");
      const node = new ElementNode(context, "div", { title: val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.getAttribute("title")).toBe("hello");
      setVal(null);
      flushPendingUpdates();
      expect(el.hasAttribute("title")).toBe(false);
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

    test("sets classes via CSSTemplate alone", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", { class: tpl });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(tpl.className)).toBe(true);
    });

    test("sets classes via array of CSSTemplate and object", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", {
        class: [tpl, { foo: true, bar: false }],
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(tpl.className)).toBe(true);
      expect(el.classList.contains("foo")).toBe(true);
      expect(el.classList.contains("bar")).toBe(false);
    });

    test("sets classes via array of multiple CSSTemplates", () => {
      const { context, container } = setup();
      const a = css`
        color: red;
      `;
      const b = css`
        font-size: 16px;
      `;
      const node = new ElementNode(context, "div", { class: [a, b] });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(a.className)).toBe(true);
      expect(el.classList.contains(b.className)).toBe(true);
    });

    test("conditionally applies class via .when(true)", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", { class: tpl.when(true) });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(tpl.className)).toBe(true);
    });

    test("conditionally applies class via .when(false)", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", { class: tpl.when(false) });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(tpl.className)).toBe(false);
    });

    test("reactively toggles class via .when(getter)", () => {
      const { context, container } = setup();
      const [isActive, setIsActive] = createAtom(false);
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", { class: tpl.when(isActive) });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(tpl.className)).toBe(false);
      setIsActive(true);
      flushPendingUpdates();
      expect(el.classList.contains(tpl.className)).toBe(true);
      setIsActive(false);
      flushPendingUpdates();
      expect(el.classList.contains(tpl.className)).toBe(false);
    });

    test("mixes .when() with other class values in array", () => {
      const { context, container } = setup();
      const [isActive, setIsActive] = createAtom(false);
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", {
        class: ["base", tpl.when(isActive)],
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains("base")).toBe(true);
      expect(el.classList.contains(tpl.className)).toBe(false);
      setIsActive(true);
      flushPendingUpdates();
      expect(el.classList.contains(tpl.className)).toBe(true);
    });

    test("detaches template when swapped out via signal", () => {
      const { context, container } = setup();
      const [isActive, setIsActive] = createAtom(false);
      const a = css`
        color: red;
      `;
      const b = css`
        color: blue;
      `;
      const node = new ElementNode(context, "div", {
        class: () => (isActive() ? [a, b] : [a]),
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(a.className)).toBe(true);
      expect(el.classList.contains(b.className)).toBe(false);
      setIsActive(true);
      flushPendingUpdates();
      expect(el.classList.contains(b.className)).toBe(true);
      setIsActive(false);
      flushPendingUpdates();
      expect(el.classList.contains(b.className)).toBe(false);
      expect(el.classList.contains(a.className)).toBe(true);
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

    test("throws when CSSTemplate is passed to style", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", { style: tpl });
      expect(() => node.mount(container)).toThrow(
        /CSS templates are not supported on the "style" prop\. Pass them to "class" instead/,
      );
    });

    test("throws when ConditionalTemplate is passed to style", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", { style: tpl.when(true) });
      expect(() => node.mount(container)).toThrow(/CSS templates are not supported/);
    });

    test("throws when CSSTemplate is in style array", () => {
      const { context, container } = setup();
      const tpl = css`
        color: red;
      `;
      const node = new ElementNode(context, "div", {
        style: [tpl, { background: "blue" }],
      });
      expect(() => node.mount(container)).toThrow(/CSS templates are not supported/);
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

    test("handles camelCase event names (onMouseEnter)", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { onMouseEnter: handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("handles on: convention (on:click)", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { "on:click": handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("on:click with handler object (handleEvent)", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", {
        "on:click": { handleEvent: handler },
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("on:click with handler object and options", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", {
        "on:click": { handleEvent: handler, once: true },
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
      el.click();
      expect(handler).toHaveBeenCalledTimes(1); // once=true, called only once
    });

    test("on:click with custom event type", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "div", {
        "on:mycustomevent": handler,
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.dispatchEvent(new CustomEvent("mycustomevent"));
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

    test("unsubscribes on: listeners on unmount", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { "on:click": handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
      node.unmount();
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("unsubscribes on: listeners on unmount", () => {
      const { context, container } = setup();
      const handler = vi.fn();
      const node = new ElementNode(context, "button", { "on:click": handler });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
      node.unmount();
      el.click();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    test("passing a getter to onClick is not unwrapped", () => {
      const { context, container } = setup();
      const realHandler = vi.fn();
      const getter = () => realHandler;
      const node = new ElementNode(context, "button", { onClick: getter });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      el.click();
      // getter itself is registered as the listener; the handler it returns
      // is never called by the browser
      expect(realHandler).toHaveBeenCalledTimes(0);
    });

    test("passing a signal to onClick does not crash", () => {
      const { context, container } = setup();
      const [val] = createAtom("hello");
      const node = new ElementNode(context, "button", { onClick: val });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(() => el.click()).not.toThrow();
    });

    test("non-function value does not throw", () => {
      const { context, container } = setup();
      const node = new ElementNode(context, "button", { onClick: 42 as any });
      node.mount(container);
      const el = container.children[0] as HTMLElement;
      expect(() => el.click()).not.toThrow();
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

  describe("template cascade ordering", () => {
    function sheet() {
      return document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1];
    }
    function ruleIndex(selector: string): number {
      return Array.from(sheet().cssRules).findIndex(
        (r) => (r as CSSStyleRule).selectorText === selector,
      );
    }

    test("plain then conditional: conditional rule comes AFTER plain rule in sheet", () => {
      const { context, container } = setup();
      const base = css`
        color: crimson;
      `;
      const override = css`
        color: navy;
      `;
      const node = new ElementNode(context, "div", { class: [base, override.when(true)] });
      node.mount(container);

      const baseIdx = ruleIndex(`.${base.className}`);
      const overrideIdx = ruleIndex(`.${override.className}`);
      expect(baseIdx).toBeGreaterThanOrEqual(0);
      expect(overrideIdx).toBeGreaterThan(baseIdx);
    });

    test("conditional then plain: plain rule comes AFTER conditional rule in sheet", () => {
      const { context, container } = setup();
      const base = css`
        background: peru;
      `;
      const override = css`
        background: salmon;
      `;
      const node = new ElementNode(context, "div", { class: [override.when(true), base] });
      node.mount(container);

      const overrideIdx = ruleIndex(`.${override.className}`);
      const baseIdx = ruleIndex(`.${base.className}`);
      expect(overrideIdx).toBeGreaterThanOrEqual(0);
      expect(baseIdx).toBeGreaterThan(overrideIdx);
    });

    test("conditional template after plain wins cascade when its condition is active", () => {
      const { context, container } = setup();
      const [isActive, setIsActive] = createAtom(false);
      const base = css`
        margin: 5px;
      `;
      const override = css`
        margin: 10px;
      `;
      const node = new ElementNode(context, "div", {
        class: [base, override.when(isActive)],
      });
      node.mount(container);
      const el = container.children[0] as HTMLElement;

      // When inactive, only base is on the element.
      expect(el.classList.contains(base.className)).toBe(true);
      expect(el.classList.contains(override.className)).toBe(false);

      setIsActive(true);
      flushPendingUpdates();

      // Both classes present; override's rule sits after base's in the sheet,
      // so it wins the cascade tie.
      expect(el.classList.contains(base.className)).toBe(true);
      expect(el.classList.contains(override.className)).toBe(true);
      const baseIdx = ruleIndex(`.${base.className}`);
      const overrideIdx = ruleIndex(`.${override.className}`);
      expect(baseIdx).toBeGreaterThanOrEqual(0);
      expect(overrideIdx).toBeGreaterThan(baseIdx);

      // Verify the override rule's content matches the override template.
      const overrideRule = Array.from(sheet().cssRules).find(
        (r) => (r as CSSStyleRule).selectorText === `.${override.className}`,
      ) as CSSStyleRule;
      expect(overrideRule?.style.margin).toBe("10px");
    });

    test("multiple conditional templates attach in array order", () => {
      const { context, container } = setup();
      const [a, setA] = createAtom(true);
      const [b, setB] = createAtom(true);
      const t1 = css`
        letter-spacing: 1px;
      `;
      const t2 = css`
        line-height: 2;
      `;
      const t3 = css`
        word-spacing: 3px;
      `;
      const node = new ElementNode(context, "div", {
        class: [t1, t2.when(a), t3.when(b)],
      });
      node.mount(container);

      const i1 = ruleIndex(`.${t1.className}`);
      const i2 = ruleIndex(`.${t2.className}`);
      const i3 = ruleIndex(`.${t3.className}`);
      expect(i1).toBeGreaterThanOrEqual(0);
      expect(i2).toBeGreaterThan(i1);
      expect(i3).toBeGreaterThan(i2);

      const el = container.children[0] as HTMLElement;
      expect(el.classList.contains(t1.className)).toBe(true);
      expect(el.classList.contains(t2.className)).toBe(true);
      expect(el.classList.contains(t3.className)).toBe(true);

      // Toggling one off only removes its class (and its sub); the others stay.
      setA(false);
      flushPendingUpdates();
      expect(el.classList.contains(t1.className)).toBe(true);
      expect(el.classList.contains(t2.className)).toBe(false);
      expect(el.classList.contains(t3.className)).toBe(true);

      setB(false);
      flushPendingUpdates();
      expect(el.classList.contains(t3.className)).toBe(false);
    });


  });


});
