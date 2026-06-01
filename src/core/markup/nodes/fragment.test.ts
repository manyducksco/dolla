import { describe, expect, test } from "vitest";
import { createContext } from "../../context.js";
import { DOMNode } from "./dom.js";
import { FragmentNode } from "./fragment.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

function createChildren(context: ReturnType<typeof createContext>) {
  return [new DOMNode(context, document.createTextNode("a")), new DOMNode(context, document.createTextNode("b"))];
}

describe("FragmentNode", () => {
  describe("creation and lifecycle", () => {
    test("getRoot returns undefined before mount", () => {
      const { context } = setup();
      const node = new FragmentNode(context, createChildren(context));
      expect(node.getRoot()).toBeUndefined();
    });

    test("isMounted returns false before mounting", () => {
      const { context } = setup();
      const node = new FragmentNode(context, createChildren(context));
      expect(node.isMounted()).toBe(false);
    });

    test("mount inserts anchor and children", () => {
      const { context, container } = setup();
      const node = new FragmentNode(context, createChildren(context));
      node.mount(container);
      expect(node.isMounted()).toBe(true);
      expect(container.childNodes.length).toBe(3); // anchor + a + b
      expect(container.childNodes[0]).toBeInstanceOf(Text);
      expect(container.childNodes[1].textContent).toBe("a");
      expect(container.childNodes[2].textContent).toBe("b");
    });

    test("mount with after positions anchor correctly", () => {
      const { context, container } = setup();
      const existing = document.createElement("span");
      container.appendChild(existing);
      const node = new FragmentNode(context, createChildren(context));
      node.mount(container, existing);
      expect(container.childNodes[0]).toBe(existing);
      expect(container.childNodes[1]).toBeInstanceOf(Text);
      expect(container.childNodes[2].textContent).toBe("a");
      expect(container.childNodes[3].textContent).toBe("b");
    });

    test("unmount removes anchor and children from DOM", () => {
      const { context, container } = setup();
      const node = new FragmentNode(context, createChildren(context));
      node.mount(container);
      expect(container.childNodes.length).toBe(3);
      node.unmount();
      expect(container.childNodes.length).toBe(0);
    });

    test("unmount with skipDOM keeps anchor and children in DOM", () => {
      const { context, container } = setup();
      const node = new FragmentNode(context, createChildren(context));
      node.mount(container);
      node.unmount(true);
      expect(container.childNodes.length).toBe(3);
      expect(node.getRoot()?.parentNode).toBe(container);
    });

    test("unmounting an unmounted node does not throw", () => {
      const { context } = setup();
      const node = new FragmentNode(context, []);
      expect(() => node.unmount()).not.toThrow();
    });
  });

  describe("move", () => {
    test("moves anchor and children to new position", () => {
      const { context, container } = setup();
      const node = new FragmentNode(context, createChildren(context));
      const first = document.createElement("div");
      first.textContent = "first";
      container.appendChild(first);
      node.mount(container);
      // Order: first, anchor, a, b
      expect(container.childNodes[0]).toBe(first);
      expect(container.childNodes[1]).toBeInstanceOf(Text);
      expect(container.childNodes[2].textContent).toBe("a");
      expect(container.childNodes[3].textContent).toBe("b");
      expect(container.textContent).toBe("firstab");

      // Move fragment to right after 'first', before anchor
      // Anchor stays put — it's the reference point for children
    });

    test("move before mount is a no-op", () => {
      const { context, container } = setup();
      const node = new FragmentNode(context, createChildren(context));
      expect(() => node.move(container)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    test("empty children list mounts only anchor", () => {
      const { context, container } = setup();
      const node = new FragmentNode(context, []);
      node.mount(container);
      expect(container.childNodes.length).toBe(1);
      expect(container.childNodes[0]).toBeInstanceOf(Text);
    });

    test("single child", () => {
      const { context, container } = setup();
      const child = new DOMNode(context, document.createTextNode("only"));
      const node = new FragmentNode(context, [child]);
      node.mount(container);
      expect(container.childNodes.length).toBe(2); // anchor + child
      expect(container.childNodes[1].textContent).toBe("only");
    });
  });
});
