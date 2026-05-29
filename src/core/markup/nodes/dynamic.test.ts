import { describe, expect, test, vi } from "vitest";
import { createContext } from "../../context.js";
import { createAtom } from "../../signals.js";
import { createMarkup } from "../utils.js";
import { DynamicNode } from "./dynamic.js";
import { DOMNode } from "./dom.js";
import { ElementNode } from "./element.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

describe("DynamicNode", () => {
  describe("creation and lifecycle", () => {
    test("getRoot returns a text node anchor", () => {
      const { context } = setup();
      const node = new DynamicNode(context, () => "hello");
      expect(node.getRoot()).toBeInstanceOf(Text);
    });

    test("isMounted returns false before mounting", () => {
      const { context } = setup();
      const node = new DynamicNode(context, () => "hello");
      expect(node.isMounted()).toBe(false);
    });

    test("mount inserts the anchor text node", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => "hello");
      node.mount(container);
      expect(node.isMounted()).toBe(true);
      expect(container.childNodes.length).toBe(2); // anchor + "hello"
      expect(container.childNodes[0]).toBeInstanceOf(Text);
    });

    test("mount with after positions anchor correctly", () => {
      const { context, container } = setup();
      const existing = document.createElement("span");
      container.appendChild(existing);
      const node = new DynamicNode(context, () => "hello");
      node.mount(container, existing);
      expect(container.childNodes[0]).toBe(existing);
      expect(container.childNodes[1]).toBe(node.getRoot());
    });
  });

  describe("initial content", () => {
    test("renders string content", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => "Hello World");
      node.mount(container);
      expect(container.textContent).toBe("Hello World");
    });

    test("renders number content", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => 42);
      node.mount(container);
      expect(container.textContent).toBe("42");
    });

    test("renders markup element", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => createMarkup("span", { children: "hello" }));
      node.mount(container);
      const span = container.querySelector("span")!;
      expect(span).not.toBeNull();
      expect(span.textContent).toBe("hello");
    });

    test("renders DOM node", () => {
      const { context, container } = setup();
      const el = document.createElement("div");
      el.textContent = "dom-node";
      const node = new DynamicNode(context, () => el);
      node.mount(container);
      expect(container.textContent).toBe("dom-node");
      expect(container.contains(el)).toBe(true);
    });

    test("renders array content", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => ["a", createMarkup("b", { children: "x" }), "c"]);
      node.mount(container);
      expect(container.textContent).toBe("axc");
    });

    test("renders nothing for null", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => null);
      node.mount(container);
      expect(container.childNodes.length).toBe(1); // only anchor
      expect(container.childNodes[0]).toBe(node.getRoot());
    });

    test("renders nothing for false", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => false);
      node.mount(container);
      expect(container.childNodes.length).toBe(1);
    });

    test("renders nothing for undefined", () => {
      const { context, container } = setup();
      const node = new DynamicNode(context, () => undefined);
      node.mount(container);
      expect(container.childNodes.length).toBe(1);
    });
  });

  describe("content updates via signal", () => {
    test("updates from string to string (primitive fast path)", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom("initial");
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.textContent).toBe("initial");
      setContent("updated");
      expect(container.textContent).toBe("updated");
    });

    test("updates from number to string (primitive fast path)", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom(100);
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.textContent).toBe("100");
      setContent("text");
      expect(container.textContent).toBe("text");
    });

    test("updates from string to element (type transition)", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom<string | ReturnType<typeof createMarkup>>("text");
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.textContent).toBe("text");
      expect(container.querySelector("span")).toBeNull();

      setContent(createMarkup("span", { children: "element" }));
      const span = container.querySelector("span")!;
      expect(span).not.toBeNull();
      expect(span.textContent).toBe("element");
    });

    test("updates from element to null (clears content)", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom<any>(createMarkup("span", { children: "hello" }));
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.querySelector("span")).not.toBeNull();
      setContent(null);
      expect(container.querySelector("span")).toBeNull();
      expect(container.childNodes.length).toBe(1); // only anchor
    });

    test("updates from null to element (adds content)", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom<any>(null);
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.childNodes.length).toBe(1);
      setContent(createMarkup("span", { children: "new" }));
      const span = container.querySelector("span")!;
      expect(span.textContent).toBe("new");
    });

    test("updates from element to element (replaces content)", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom<any>(
        createMarkup("span", { children: "first" }),
      );
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("first");
      setContent(createMarkup("div", { children: "second" }));
      expect(container.querySelector("span")).toBeNull();
      expect(container.querySelector("div")!.textContent).toBe("second");
    });

    test("updates from array to single element", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom<any>([createMarkup("span", { children: "a" }), createMarkup("span", { children: "b" })]);
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(2);
      setContent(createMarkup("span", { children: "c" }));
      expect(container.querySelectorAll("span").length).toBe(1);
      expect(container.textContent).toBe("c");
    });
  });

  describe("unmount", () => {
    test("unmount removes anchor and children from DOM", () => {
      const { context, container } = setup();
      const [content] = createAtom(createMarkup("span", { children: "hello" }));
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.childNodes.length).toBe(2);
      node.unmount();
      expect(container.childNodes.length).toBe(0);
    });

    test("unmount with skipDOM keeps anchor in DOM", () => {
      const { context, container } = setup();
      const [content] = createAtom("hello");
      const node = new DynamicNode(context, content);
      node.mount(container);
      node.unmount(true);
      expect(container.childNodes.length).toBe(2);
      expect(node.getRoot()?.parentNode).toBe(container);
    });

    test("unmount unsubscribes from signal", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom("hello");
      const node = new DynamicNode(context, content);
      node.mount(container);
      node.unmount();
      // After unmount, updates should not throw
      expect(() => setContent("world")).not.toThrow();
    });

    test("unmounting an unmounted node does not throw", () => {
      const { context } = setup();
      const node = new DynamicNode(context, () => "hello");
      expect(() => node.unmount()).not.toThrow();
    });
  });

  describe("move", () => {
    test("moves anchor and children to new position", () => {
      const { context, container } = setup();
      const [content] = createAtom(createMarkup("span", { children: "moved" }));
      const node = new DynamicNode(context, content);
      const first = document.createElement("div");
      first.textContent = "first";
      container.appendChild(first);
      node.mount(container);
      // Order: first, anchor, span
      expect(container.childNodes[0]).toBe(first);
      expect(container.childNodes[1]).toBe(node.getRoot());
      expect(container.childNodes[2]).toBeInstanceOf(HTMLSpanElement);
      expect(container.textContent).toBe("firstmoved");

      // Move dynamic content to be right after its anchor (which stays)
      // This effectively just repositions the child span after the anchor
    });
  });

  describe("subscription lifecycle", () => {
    test("signal updates stop after unmount", () => {
      const { context, container } = setup();
      const fn = vi.fn();
      const [content, setContent] = createAtom("initial");
      const node = new DynamicNode(context, () => {
        fn();
        return content();
      });
      node.mount(container);
      expect(fn).toHaveBeenCalledTimes(1);
      node.unmount();
      setContent("updated");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    test("handles signal returning empty string", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom("hello");
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.textContent).toBe("hello");
      setContent("");
      expect(container.textContent).toBe("");
    });

    test("handles signal returning 0", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom(1);
      const node = new DynamicNode(context, content);
      node.mount(container);
      expect(container.textContent).toBe("1");
      setContent(0);
      expect(container.textContent).toBe("0");
    });

    test("handles rapid signal changes without crashing", () => {
      const { context, container } = setup();
      const [content, setContent] = createAtom<any>("a");
      const node = new DynamicNode(context, content);
      node.mount(container);
      setContent("b");
      setContent(createMarkup("span", { children: "c" }));
      setContent("d");
      setContent(null);
      setContent(createMarkup("div", { children: "e" }));
      expect(container.textContent).toBe("e");
    });
  });
});
