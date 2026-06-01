import { describe, expect, test, vi } from "vitest";
import { createContext } from "../../context.js";
import { createAtom } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { createMarkup } from "../utils.js";
import { RepeatNode } from "./repeat.js";

type Item = { id: number; text: string };

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

function keyFn(item: Item) {
  return item.id;
}

function renderFn(item: ReturnType<typeof createAtom<Item>>[0], index: ReturnType<typeof createAtom<number>>[0]) {
  return createMarkup("span", { children: () => `${item().text}:${index()}` });
}

describe("RepeatNode", () => {
  describe("creation and lifecycle", () => {
    test("getRoot returns a text node anchor", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(node.getRoot()).toBeInstanceOf(Text);
    });

    test("isMounted returns false before mounting", () => {
      const { context } = setup();
      const [items] = createAtom<Item[]>([]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      expect(node.isMounted()).toBe(false);
    });

    test("mount inserts the anchor text node", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(node.isMounted()).toBe(true);
      expect(container.childNodes[0]).toBe(node.getRoot());
    });
  });

  describe("initial render", () => {
    test("renders items with correct keys", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2);
      expect(spans[0].textContent).toBe("one:0");
      expect(spans[1].textContent).toBe("two:1");
    });

    test("renders nothing for empty list", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(0);
      expect(container.childNodes.length).toBe(1); // only anchor
    });
  });

  describe("dynamic updates", () => {
    test("appends items to the end", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([{ id: 1, text: "one" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(1);

      setItems([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2);
      expect(spans[0].textContent).toBe("one:0");
      expect(spans[1].textContent).toBe("two:1");
    });

    test("prepends items to the beginning", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([{ id: 2, text: "two" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(1);

      setItems([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2);
      expect(spans[0].textContent).toBe("one:0");
      expect(spans[1].textContent).toBe("two:1");
    });

    test("removes items from the middle", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
        { id: 3, text: "three" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(3);

      setItems([
        { id: 1, text: "one" },
        { id: 3, text: "three" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2);
      expect(spans[0].textContent).toBe("one:0");
      expect(spans[1].textContent).toBe("three:1");
    });

    test("removes all items (becomes empty)", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(2);

      setItems([]);
      flushPendingUpdates();
      expect(container.querySelectorAll("span").length).toBe(0);
    });

    test("reorders items", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
        { id: 3, text: "three" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span")[0].textContent).toBe("one:0");

      setItems([
        { id: 3, text: "three" },
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(3);
      expect(spans[0].textContent).toBe("three:0");
      expect(spans[1].textContent).toBe("one:1");
      expect(spans[2].textContent).toBe("two:2");
    });

    test("reuses nodes for items with same key (keyed reconciliation)", () => {
      const { context, container } = setup();
      const renderSpy = vi.fn(renderFn);
      const [items, setItems] = createAtom<Item[]>([{ id: 1, text: "one" }]);
      const node = new RepeatNode(context, items, keyFn, renderSpy);
      node.mount(container);
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(container.querySelector("span")!.textContent).toBe("one:0");

      // Update item with same key, different data
      setItems([{ id: 1, text: "updated" }]);
      flushPendingUpdates();
      // Should NOT call renderSpy again (node is reused, just setItem/setIndex)
      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(container.querySelector("span")!.textContent).toBe("updated:0");
    });

    test("inserts items at a specific position", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 3, text: "three" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(2);

      setItems([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
        { id: 3, text: "three" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(3);
      expect(spans[0].textContent).toBe("one:0");
      expect(spans[1].textContent).toBe("two:1");
      expect(spans[2].textContent).toBe("three:2");
    });

    test("reverses item order", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);

      setItems([
        { id: 3, text: "c" },
        { id: 2, text: "b" },
        { id: 1, text: "a" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("c:0");
      expect(spans[1].textContent).toBe("b:1");
      expect(spans[2].textContent).toBe("a:2");
    });

    test("moves first item to the end", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);

      setItems([
        { id: 2, text: "b" },
        { id: 3, text: "c" },
        { id: 1, text: "a" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("b:0");
      expect(spans[1].textContent).toBe("c:1");
      expect(spans[2].textContent).toBe("a:2");
    });

    test("shuffles items arbitrarily", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
        { id: 4, text: "d" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);

      setItems([
        { id: 4, text: "d" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
        { id: 1, text: "a" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("d:0");
      expect(spans[1].textContent).toBe("b:1");
      expect(spans[2].textContent).toBe("c:2");
      expect(spans[3].textContent).toBe("a:3");
    });

    test("complex update with insert, delete, and reorder simultaneously", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
        { id: 4, text: "d" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);

      setItems([
        { id: 4, text: "d" },
        { id: 5, text: "e" },
        { id: 2, text: "b" },
      ]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(3);
      expect(spans[0].textContent).toBe("d:0");
      expect(spans[1].textContent).toBe("e:1");
      expect(spans[2].textContent).toBe("b:2");
    });

    test("reuses DOM nodes when reordering (keyed reconciliation)", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
        { id: 3, text: "c" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);

      const spansBefore = Array.from(container.querySelectorAll("span"));

      setItems([
        { id: 3, text: "c" },
        { id: 1, text: "a" },
        { id: 2, text: "b" },
      ]);
      flushPendingUpdates();

      const spansAfter = Array.from(container.querySelectorAll("span"));
      expect(spansAfter.length).toBe(3);
      expect(spansAfter[0]).toBe(spansBefore[2]); // key 3 moved to front
      expect(spansAfter[1]).toBe(spansBefore[0]); // key 1 moved to middle
      expect(spansAfter[2]).toBe(spansBefore[1]); // key 2 moved to end
    });

    test("handles multiple rapid signal updates before flush", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);

      setItems([
        { id: 2, text: "b" },
        { id: 1, text: "a" },
      ]); // reorder
      setItems([
        { id: 2, text: "b" },
        { id: 1, text: "a" },
        { id: 3, text: "c" },
      ]); // append
      setItems([
        { id: 3, text: "c" },
        { id: 2, text: "b" },
      ]); // remove + reorder
      flushPendingUpdates();

      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(2);
      expect(spans[0].textContent).toBe("c:0");
      expect(spans[1].textContent).toBe("b:1");
    });
  });

  describe("render function gets correct values", () => {
    test("render receives updated item values via getter", () => {
      const renderAssert = vi.fn(
        (item: ReturnType<typeof createAtom<Item>>[0], _index: ReturnType<typeof createAtom<number>>[0]) => {
          return createMarkup("span", { children: () => item().text });
        },
      );
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([{ id: 1, text: "init" }]);
      const node = new RepeatNode(context, items, keyFn, renderAssert);
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("init");

      setItems([{ id: 1, text: "changed" }]);
      flushPendingUpdates();
      expect(container.querySelector("span")!.textContent).toBe("changed");
    });

    test("render receives updated index values", () => {
      const renderAssert = vi.fn(
        (item: ReturnType<typeof createAtom<Item>>[0], index: ReturnType<typeof createAtom<number>>[0]) => {
          return createMarkup("span", { children: () => `${item().text}:${index()}` });
        },
      );
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 2, text: "b" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderAssert);
      node.mount(container);
      expect(container.querySelectorAll("span")[0].textContent).toBe("a:0");
      expect(container.querySelectorAll("span")[1].textContent).toBe("b:1");

      // Remove first item - second item's index should change from 1 to 0
      setItems([{ id: 2, text: "b" }]);
      flushPendingUpdates();
      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(1);
      expect(spans[0].textContent).toBe("b:0");
    });
  });

  describe("unmount", () => {
    test("unmount removes anchor and items from DOM", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.children.length).toBe(2);
      node.unmount();
      expect(container.children.length).toBe(0);
      expect(container.childNodes.length).toBe(0);
    });

    test("unmount stops listening to signal", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([{ id: 1, text: "one" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      node.unmount();
      expect(() => setItems([])).not.toThrow();
    });

    test("unmount with skipDOM keeps nodes in DOM", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([{ id: 1, text: "one" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      node.unmount(true);
      expect(container.querySelector("span")).not.toBeNull();
    });
  });

  describe("move", () => {
    test("repositions the anchor text node after the target", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([{ id: 1, text: "one" }]);
      const before = document.createElement("div");
      const after = document.createElement("div");
      container.append(before, after);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container, before);

      const childIdx = (n: Node | null) => Array.prototype.indexOf.call(container.childNodes, n!);

      // Anchor is between `before` and `after`, item spans sit after the anchor
      expect(childIdx(node.getRoot()!)).toBeGreaterThan(childIdx(before));
      expect(childIdx(node.getRoot()!)).toBeLessThan(childIdx(after));

      node.move(container, after);

      // Anchor is now after `after`
      expect(childIdx(node.getRoot()!)).toBeGreaterThan(childIdx(after));
    });

    test("move preserves rendered content", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([
        { id: 1, text: "one" },
        { id: 2, text: "two" },
      ]);
      const before = document.createElement("div");
      const after = document.createElement("div");
      container.append(before, after);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container, before);

      node.move(container, after);
      const spans = container.querySelectorAll("span");
      expect(spans[0].textContent).toBe("one:0");
      expect(spans[1].textContent).toBe("two:1");
    });

    test("does not throw when called on unmounted node", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([{ id: 1, text: "one" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      expect(() => node.move(container)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    test("handles zero id key correctly", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([{ id: 0, text: "zero-key" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("zero-key:0");
    });

    test("handles single item list", () => {
      const { context, container } = setup();
      const [items] = createAtom<Item[]>([{ id: 99, text: "solo" }]);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("solo:0");
    });

    test("handles large number of items", () => {
      const { context, container } = setup();
      const data = Array.from({ length: 100 }, (_, i) => ({ id: i, text: `item-${i}` }));
      const [items] = createAtom(data);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      expect(container.querySelectorAll("span").length).toBe(100);
      expect(container.querySelectorAll("span")[50].textContent).toBe("item-50:50");
    });
  });
});
