import { describe, expect, test, vi } from "vitest";
import { createContext } from "../../context.js";
import { createAtom } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { createMarkup } from "../utils.js";
import { createPortal } from "../helpers.js";
import { ElementNode } from "./element.js";
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

  describe("clearing", () => {
    const makeItems = (count: number): Item[] => Array.from({ length: count }, (_, i) => ({ id: i, text: String(i) }));
    const label = (item: () => Item) => createMarkup("span", { children: () => item().text });

    /** Mounts a list between a `<b>` and an `<i>`. */
    function setupBetweenSiblings(count: number, render: (item: () => Item) => any = label) {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>(makeItems(count));
      const before = new ElementNode(context, "b", { children: "before" });
      const after = new ElementNode(context, "i", { children: "after" });
      const node = new RepeatNode(context, items, keyFn, render);
      before.mount(container);
      node.mount(container, before.getRoot());
      after.mount(container, node.getLastNode());
      return { container, node, setItems };
    }

    test("leaves the nodes around the list in place", () => {
      const { container, setItems } = setupBetweenSiblings(5);
      expect(container.textContent).toBe("before01234after");

      setItems([]);
      flushPendingUpdates();
      expect(container.innerHTML).toBe("<b>before</b><i>after</i>");

      setItems([{ id: 9, text: "nine" }]);
      flushPendingUpdates();
      expect(container.innerHTML).toBe("<b>before</b><span>nine</span><i>after</i>");
    });

    test("renders again after being cleared when the list is its parent's only content", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>(makeItems(5));
      const node = new RepeatNode(context, items, keyFn, label);
      node.mount(container);

      setItems([]);
      flushPendingUpdates();
      expect(container.innerHTML).toBe("");
      expect(node.isMounted()).toBe(true);

      setItems(makeItems(3));
      flushPendingUpdates();
      expect(container.innerHTML).toBe("<span>0</span><span>1</span><span>2</span>");
    });

    test("unmounting leaves the nodes around the list in place", () => {
      const { container, node } = setupBetweenSiblings(5);
      node.unmount();
      expect(container.innerHTML).toBe("<b>before</b><i>after</i>");
      expect(container.childNodes.length).toBe(2);
    });

    test.each([
      ["clearing", (setItems: (items: Item[]) => void) => setItems([])],
      ["unmounting", (_: unknown, node: RepeatNode<Item>) => node.unmount()],
    ])("%s runs the cleanup of every item and stops its updates", (_label, act) => {
      const { context, container } = setup();
      const cleanup = vi.fn();
      const [text, setText] = createAtom("a");
      const read = vi.fn(() => text());
      const [items, setItems] = createAtom<Item[]>(makeItems(4));
      const node = new RepeatNode(context, items, keyFn, () =>
        createMarkup("span", { ref: () => cleanup, children: read }),
      );
      node.mount(container);
      const calls = read.mock.calls.length;

      act(setItems, node);
      flushPendingUpdates();
      expect(cleanup).toHaveBeenCalledTimes(4);
      expect(container.querySelectorAll("span").length).toBe(0);

      setText("b");
      flushPendingUpdates();
      expect(read).toBeCalledTimes(calls);
    });

    test("removes what items rendered through a portal", () => {
      const target = document.createElement("div");
      const { container, setItems } = setupBetweenSiblings(3, (item) =>
        createPortal(target, createMarkup("em", { children: () => item().text })),
      );
      expect(target.textContent).toBe("012");

      setItems([]);
      flushPendingUpdates();
      expect(target.innerHTML).toBe("");
      expect(container.innerHTML).toBe("<b>before</b><i>after</i>");
    });

    test("removes items that render several nodes, text or nothing", () => {
      const { container, setItems } = setupBetweenSiblings(4, (item) => {
        const id = item().id;
        if (id === 0) return [createMarkup("span", { children: "a" }), createMarkup("span", { children: "b" })];
        if (id === 1) return () => item().text;
        if (id === 2) return null;
        return "plain";
      });
      expect(container.textContent).toBe("beforeab1plainafter");

      setItems([]);
      flushPendingUpdates();
      expect(container.innerHTML).toBe("<b>before</b><i>after</i>");
    });

    // Removing rows one at a time is what makes clearing a long list slow.
    test.each([
      ["between other nodes", "<b>before</b><i>after</i>"],
      ["at the end of its parent", "<b>before</b>"],
    ])("removes a list %s as one range", (_label, remaining) => {
      const { container, setItems } = setupBetweenSiblings(50);
      if (!remaining.includes("<i>")) container.querySelector("i")!.remove();
      const deleteContents = vi.spyOn(Range.prototype, "deleteContents");

      try {
        setItems([]);
        flushPendingUpdates();
        expect(deleteContents).toHaveBeenCalledTimes(1);
      } finally {
        deleteContents.mockRestore();
      }
      expect(container.innerHTML).toBe(remaining);
    });

    test("removes a single item directly", () => {
      const { container, setItems } = setupBetweenSiblings(1);
      const deleteContents = vi.spyOn(Range.prototype, "deleteContents");

      try {
        setItems([]);
        flushPendingUpdates();
        expect(deleteContents).not.toHaveBeenCalled();
      } finally {
        deleteContents.mockRestore();
      }
      expect(container.innerHTML).toBe("<b>before</b><i>after</i>");
    });

    test("still removes the list when a cleanup removes the node after it", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>(makeItems(3));
      const after = new ElementNode(context, "i", { children: "after" });
      const node = new RepeatNode(context, items, keyFn, (item) =>
        createMarkup("span", {
          ref: () => () => after.getRoot().remove(),
          children: () => item().text,
        }),
      );
      node.mount(container);
      after.mount(container, node.getLastNode());

      setItems([]);
      flushPendingUpdates();
      expect(container.innerHTML).toBe("");
    });

    test("still removes the list when a cleanup removes an item's own element", () => {
      const { container, setItems } = setupBetweenSiblings(3, (item) =>
        createMarkup("span", {
          ref: (el: HTMLElement) => () => el.remove(),
          children: () => item().text,
        }),
      );

      setItems([]);
      flushPendingUpdates();
      expect(container.innerHTML).toBe("<b>before</b><i>after</i>");
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
  describe("duplicate keys", () => {
    test("renders the first occurrence once and does not leak the duplicate", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom<Item[]>([
        { id: 1, text: "a" },
        { id: 1, text: "dup" },
        { id: 2, text: "b" },
      ]);
      const render = vi.fn(renderFn);
      const node = new RepeatNode(context, items, keyFn, render);
      node.mount(container);

      expect(Array.from(container.querySelectorAll("span"), (s) => s.textContent)).toEqual(["a:0", "b:2"]);
      expect(render).toBeCalledTimes(2);

      setItems([{ id: 2, text: "b" }]);
      flushPendingUpdates();
      expect(Array.from(container.querySelectorAll("span"), (s) => s.textContent)).toEqual(["b:0"]);
    });
  });

  describe("move efficiency", () => {
    function setupList(count: number) {
      const { context, container } = setup();
      const data = Array.from({ length: count }, (_, i) => ({ id: i, text: String(i) }));
      const [items, setItems] = createAtom<Item[]>(data);
      const node = new RepeatNode(context, items, keyFn, renderFn);
      node.mount(container);
      const inserts = vi.spyOn(container, "insertBefore");
      const texts = () => Array.from(container.querySelectorAll("span"), (s) => s.textContent!.split(":")[0]);
      return { data, setItems, inserts, texts };
    }

    test("moving the first item to the end moves one node", () => {
      const { data, setItems, inserts, texts } = setupList(50);
      const next = [...data.slice(1), data[0]];
      setItems(next);
      flushPendingUpdates();

      expect(texts()).toEqual(next.map((d) => d.text));
      expect(inserts).toBeCalledTimes(1);
    });

    test("moving the last item to the front moves one node", () => {
      const { data, setItems, inserts, texts } = setupList(50);
      const next = [data[49], ...data.slice(0, 49)];
      setItems(next);
      flushPendingUpdates();

      expect(texts()).toEqual(next.map((d) => d.text));
      expect(inserts).toBeCalledTimes(1);
    });

    test("swapping two items moves at most two nodes", () => {
      const { data, setItems, inserts, texts } = setupList(20);
      const next = [...data];
      [next[2], next[15]] = [next[15], next[2]];
      setItems(next);
      flushPendingUpdates();

      expect(texts()).toEqual(next.map((d) => d.text));
      expect(inserts.mock.calls.length).toBeLessThanOrEqual(2);
    });

    test("inserting and removing items without reordering only inserts the new nodes", () => {
      let seed = 7;
      const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      const { data, setItems, inserts, texts } = setupList(30);
      let current: Item[] = data;
      let nextId = 100;

      for (let round = 0; round < 50; round++) {
        const next = current.filter(() => random() > 0.2);
        let added = 0;
        for (let i = 0; i < 3; i++, added++) {
          next.splice(Math.floor(random() * (next.length + 1)), 0, { id: nextId, text: String(nextId++) });
        }
        inserts.mockClear();
        setItems(next);
        flushPendingUpdates();
        expect(texts()).toEqual(next.map((d) => d.text));
        expect(inserts).toBeCalledTimes(added);
        current = next;
      }
    });

    test("an update that only changes item data touches no DOM position", () => {
      const { data, setItems, inserts, texts } = setupList(20);
      const next = data.map((d) => (d.id % 3 === 0 ? { ...d, text: d.text + "!" } : d));
      setItems(next);
      flushPendingUpdates();

      expect(texts()).toEqual(next.map((d) => d.text));
      expect(inserts).not.toBeCalled();
    });

    test("random reorders, inserts and removals produce the right order", () => {
      let seed = 42;
      const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
      const { setItems, texts } = setupList(30);
      let nextId = 100;

      for (let round = 0; round < 50; round++) {
        let next: Item[] = Array.from({ length: 30 }, (_, i) => ({ id: i, text: String(i) }));
        next = next.filter(() => random() > 0.2);
        for (let i = 0; i < 3; i++) next.splice(Math.floor(random() * next.length), 0, { id: nextId, text: String(nextId++) });
        next.sort(() => random() - 0.5);
        setItems(next);
        flushPendingUpdates();
        expect(texts()).toEqual(next.map((d) => d.text));
      }
    });
  });
});
