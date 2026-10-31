import { afterEach, describe, expect, test } from "vitest";
import { createContext, type Context } from "../../context.js";
import { createAtom, type Getter } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { createMarkup, render } from "../utils.js";
import { branch } from "../helpers.js";
import { DOMNode } from "./dom.js";
import { FragmentNode } from "./fragment.js";
import { RepeatNode } from "./repeat.js";

/**
 * Container nodes (Repeat, Dynamic, Fragment, Branch) are represented by an
 * empty anchor with their content placed after it. Siblings that follow a
 * container must be placed after its *content*, not after its anchor.
 */

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

function repeat<T>(context: Context, items: Getter<T[]>, renderItem: (item: Getter<T>) => any) {
  return new RepeatNode<T>(context, items, (item) => item, renderItem);
}

function text(context: Context, value: string) {
  return new DOMNode(context, document.createTextNode(value));
}

describe("sibling ordering", () => {
  describe("initial mount", () => {
    test("dynamic followed by static text", () => {
      const { context, container } = setup();
      render([() => "a", "x"], context).mount(container);
      expect(container.textContent).toBe("ax");
    });

    test("repeat followed by static text inside a fragment", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      render([repeat(context, items, (n) => () => String(n())), "x"], context).mount(container);
      expect(container.textContent).toBe("12x");
    });

    test("dynamic returning [value, repeat, text]", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      const [v] = createAtom(0);
      const list = repeat(context, items, (n) => () => String(n()));
      render(() => [v(), list, "x"], context).mount(container);
      expect(container.textContent).toBe("012x");
    });

    test("branch followed by static text", () => {
      const { context, container } = setup();
      const [which] = createAtom("a");
      render([branch(which, [["a", ["a1", "a2"]]]), "x"], context).mount(container);
      expect(container.textContent).toBe("a1a2x");
    });

    test("nested fragments", () => {
      const { context, container } = setup();
      const inner = new FragmentNode(context, [text(context, "a"), text(context, "b")]);
      new FragmentNode(context, [inner, text(context, "c")]).mount(container);
      expect(container.textContent).toBe("abc");
    });

    test("repeat items that render multiple nodes", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      repeat(context, items, (n) => [() => `a${n()}`, () => `b${n()}`]).mount(container);
      expect(container.textContent).toBe("a1b1a2b2");
    });

    test("siblings inside an element", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      render(
        createMarkup("div", { children: [repeat(context, items, (n) => [() => `a${n()}`, "-"]), "x"] }),
        context,
      ).mount(container);
      expect(container.textContent).toBe("a1-a2-x");
    });
  });

  describe("updates", () => {
    test("dynamic growing from one to several nodes stays before its sibling", () => {
      const { context, container } = setup();
      const [v, setV] = createAtom<any>("a");
      render([() => v(), "x"], context).mount(container);

      setV(["a", createMarkup("b", { children: "b" }), "c"]);
      flushPendingUpdates();
      expect(container.textContent).toBe("abcx");
    });

    test("dynamic whose content is a repeat stays before its sibling", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom([1]);
      const [show, setShow] = createAtom(false);
      const list = repeat(context, items, (n) => () => String(n()));
      render([() => (show() ? list : null), "x"], context).mount(container);

      setShow(true);
      flushPendingUpdates();
      expect(container.textContent).toBe("1x");

      setItems([1, 2, 3]);
      flushPendingUpdates();
      expect(container.textContent).toBe("123x");
    });

    test("adding repeat items with multi-node content", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom([1]);
      render([repeat(context, items, (n) => [`a${n()}`, `b${n()}`]), "x"], context).mount(container);
      expect(container.textContent).toBe("a1b1x");

      setItems([1, 2, 3]);
      flushPendingUpdates();
      expect(container.textContent).toBe("a1b1a2b2a3b3x");
    });

    test("reordering repeat items with multi-node content", () => {
      const { context, container } = setup();
      const [items, setItems] = createAtom([1, 2, 3]);
      repeat(context, items, (n) => [String(n()), String(n())]).mount(container);
      expect(container.textContent).toBe("112233");

      setItems([3, 1, 2]);
      flushPendingUpdates();
      expect(container.textContent).toBe("331122");

      setItems([2, 3, 1]);
      flushPendingUpdates();
      expect(container.textContent).toBe("223311");
    });

    test("reordering repeat items whose content is a nested repeat", () => {
      const { context, container } = setup();
      const [groups, setGroups] = createAtom(["a", "b"]);
      repeat(context, groups, (g) => {
        const [inner] = createAtom([1, 2]);
        return repeat(context, inner, (n) => () => `${g()}${n()}`);
      }).mount(container);
      expect(container.textContent).toBe("a1a2b1b2");

      setGroups(["b", "a"]);
      flushPendingUpdates();
      expect(container.textContent).toBe("b1b2a1a2");
    });
  });

  describe("move", () => {
    function mountBetween(container: HTMLElement, node: { mount(p: any, a?: any): void }) {
      const before = document.createTextNode("B");
      const after = document.createTextNode("Z");
      node.mount(container);
      container.append(before, after);
      return { before, after };
    }

    test("repeat move places items directly after the target", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      const node = repeat(context, items, (n) => () => String(n()));
      const { before } = mountBetween(container, node);
      expect(container.textContent).toBe("12BZ");

      node.move(container, before);
      expect(container.textContent).toBe("B12Z");
    });

    test("repeat move carries multi-node item content", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      const node = repeat(context, items, (n) => [`a${n()}`, `b${n()}`]);
      const { before } = mountBetween(container, node);

      node.move(container, before);
      expect(container.textContent).toBe("Ba1b1a2b2Z");
    });

    test("dynamic move carries nested container content", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      const list = repeat(context, items, (n) => () => String(n()));
      const node = render(() => ["<", list, ">"], context);
      const { before } = mountBetween(container, node);
      expect(container.textContent).toBe("<12>BZ");

      node.move(container, before);
      expect(container.textContent).toBe("B<12>Z");
    });

    test("fragment move carries nested container content", () => {
      const { context, container } = setup();
      const [items] = createAtom([1, 2]);
      const node = render([repeat(context, items, (n) => () => String(n())), "x"], context);
      const { before } = mountBetween(container, node);

      node.move(container, before);
      expect(container.textContent).toBe("B12xZ");
    });

    describe("with Element.moveBefore", () => {
      const proto = Element.prototype as any;
      const original = proto.moveBefore;

      afterEach(() => {
        proto.moveBefore = original;
      });

      function polyfill() {
        proto.moveBefore = function (this: Element, node: Node, ref: Node | null) {
          return this.insertBefore(node, ref);
        };
      }

      test("repeat move carries multi-node item content", () => {
        polyfill();
        const { context, container } = setup();
        const [items] = createAtom([1, 2]);
        const node = repeat(context, items, (n) => [`a${n()}`, `b${n()}`]);
        const { before } = mountBetween(container, node);

        node.move(container, before);
        expect(container.textContent).toBe("Ba1b1a2b2Z");
      });

      test("dynamic move carries nested container content", () => {
        polyfill();
        const { context, container } = setup();
        const [items] = createAtom([1, 2]);
        const list = repeat(context, items, (n) => () => String(n()));
        const node = render(() => ["<", list, ">"], context);
        const { before } = mountBetween(container, node);

        node.move(container, before);
        expect(container.textContent).toBe("B<12>Z");
      });
    });
  });
});
