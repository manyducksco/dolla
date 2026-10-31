import { describe, expect, test, vi } from "vitest";
import { type Context, createContext, onCleanup } from "../context.js";
import { createAtom } from "../signals.js";
import { branch, createPortal, hideIf, repeat, showIf } from "./helpers.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { PortalNode } from "./nodes/portal.js";
import { RepeatNode } from "./nodes/repeat.js";
import { flushPendingUpdates } from "./scheduler.js";
import { createMarkup, render } from "./utils.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

describe("repeat", () => {
  test("static items returns an array of rendered content", () => {
    const result = repeat(
      [1, 2, 3],
      (item: number) => String(item),
      (item, index) => `${item()}:${index()}`,
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["1:0", "2:1", "3:2"]);
  });

  test("static empty array returns empty array", () => {
    const result = repeat(
      [],
      (item: number) => String(item),
      (item, index) => `${item()}:${index()}`,
    );
    expect(result).toEqual([]);
  });

  test("reactive items returns markup with RepeatNode", () => {
    const [items] = createAtom([1, 2]);
    const result = repeat(
      items,
      (item: number) => String(item),
      (item, index) => createMarkup("span", { children: () => `${item()}:${index()}` }),
    );
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    const markup = result as ReturnType<typeof createMarkup>;
    expect(markup.type).toBe(RepeatNode);
  });

  test("reactive items renders in DOM", () => {
    const { context, container } = setup();
    const [items] = createAtom([10, 20]);
    const content = repeat(
      items,
      (item: number) => String(item),
      (item, index) => createMarkup("span", { children: () => `${item()}:${index()}` }),
    );
    const node = render(content, context);
    node.mount(container);
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe("10:0");
    expect(spans[1].textContent).toBe("20:1");
  });

  test("reactive items updates reactively", () => {
    const { context, container } = setup();
    const [items, setItems] = createAtom([1]);
    const content = repeat(
      items,
      (item: number) => String(item),
      (item, index) => createMarkup("span", { children: () => `${item()}:${index()}` }),
    );
    const node = render(content, context);
    node.mount(container);
    expect(container.querySelectorAll("span").length).toBe(1);
    setItems([1, 2]);
    flushPendingUpdates();
    expect(container.querySelectorAll("span").length).toBe(2);
  });
});

describe("showIf / hideIf", () => {
  describe("showIf", () => {
    test("static truthy returns content", () => {
      expect(showIf(true, "shown")).toBe("shown");
    });

    test("static falsy returns undefined (no fallback)", () => {
      expect(showIf(false, "hidden")).toBeUndefined();
    });

    test("static falsy with fallback returns fallback", () => {
      expect(showIf(false, "hidden", "fallback")).toBe("fallback");
    });

    test("reactive truthy renders content", () => {
      const { context, container } = setup();
      const [cond] = createAtom(true);
      const content = showIf(cond, "rendered");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("rendered");
    });

    test("reactive falsy renders nothing", () => {
      const { context, container } = setup();
      const [cond] = createAtom(false);
      const content = showIf(cond, "hidden");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("");
    });

    test("reactive falsy with fallback renders fallback", () => {
      const { context, container } = setup();
      const [cond] = createAtom(false);
      const content = showIf(cond, "hidden", "fallback");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("fallback");
    });

    test("reactive condition switching truthy → falsy", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(true);
      const content = showIf(cond, "now you see me", "now you don't");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("now you see me");
      setCond(false);
      flushPendingUpdates();
      expect(container.textContent).toBe("now you don't");
    });

    test("reactive condition switching falsy → truthy", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(false);
      const content = showIf(cond, "appears", "disappears");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("disappears");
      setCond(true);
      flushPendingUpdates();
      expect(container.textContent).toBe("appears");
    });
  });

  describe("hideIf", () => {
    test("static truthy returns fallback (inverted)", () => {
      expect(hideIf(true, "hidden", "shown")).toBe("shown");
    });

    test("static falsy returns content (inverted)", () => {
      expect(hideIf(false, "shown", "hidden")).toBe("shown");
    });

    test("reactive truthy shows fallback, falsy shows content", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(true);
      const content = hideIf(cond, "content", "fallback");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("fallback");
      setCond(false);
      flushPendingUpdates();
      expect(container.textContent).toBe("content");
    });
  });
});

describe("branch", () => {
  test("static object case returns the matching content", () => {
    expect(branch("loading", { loading: "loading view", ready: "ready view" })).toBe("loading view");
  });

  test("static object case falls back when nothing matches", () => {
    expect(branch("missing", { loading: "loading view" }, "fallback")).toBe("fallback");
  });

  test("static object case renders nothing with no match or fallback", () => {
    expect(branch("missing", { loading: "loading view" })).toBeUndefined();
  });

  test("object cases match numeric and boolean values using property keys", () => {
    expect(branch(1, { 1: "number" })).toBe("number");
    expect(branch(true, { true: "yes", false: "no" })).toBe("yes");
  });

  test("static tuple case supports object keys", () => {
    const key = {};
    expect(branch(key, [[key, "matched"]], "fallback")).toBe("matched");
    expect(branch({}, [[key, "matched"]], "fallback")).toBe("fallback");
  });

  test("static tuple case uses strict equality", () => {
    expect(branch(1, [[1, "number"]])).toBe("number");
    expect(branch<string | number>("1", [[1, "number"]], "fallback")).toBe("fallback");
  });

  test("reactive value returns markup with a DynamicNode", () => {
    const [state] = createAtom("loading");
    const result = branch(state, { loading: "loading view" });
    const markup = result as ReturnType<typeof createMarkup>;
    expect(markup.type).toBe(DynamicNode);
  });

  test("reactive tuple value returns markup with a DynamicNode", () => {
    const key = {};
    const [state] = createAtom<object>(key);
    const result = branch(state, [[key, "content"]]);
    const markup = result as ReturnType<typeof createMarkup>;
    expect(markup.type).toBe(DynamicNode);
  });
});

describe("createPortal", () => {
  test("returns markup with PortalNode", () => {
    const target = document.createElement("div");
    const result = createPortal(target, "hello");
    expect(result).toBeDefined();
    const markup = result as ReturnType<typeof createMarkup>;
    expect(markup.type).toBe(PortalNode);
  });

  test("portal renders content in target element", () => {
    const { context, container } = setup();
    const target = document.createElement("div");
    const content = createPortal(target, "portal content");
    const node = render(content, context);
    node.mount(container);
    expect(target.textContent).toBe("portal content");
  });
});

describe("branch rendering", () => {
  test("switches between object cases reactively", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "b" | "c">("a");
    const node = render(branch(state, { a: "A", b: "B" }, "fallback"), context);
    node.mount(container);

    expect(container.textContent).toBe("A");

    setState("b");
    flushPendingUpdates();
    expect(container.textContent).toBe("B");

    setState("c");
    flushPendingUpdates();
    expect(container.textContent).toBe("fallback");
  });

  test("renders nothing when no case matches and there is no fallback", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "b">("a");
    const node = render(branch(state, { a: "A" }), context);
    node.mount(container);

    setState("b");
    flushPendingUpdates();
    expect(container.textContent).toBe("");
  });

  test("matches tuple keys that are not strings or symbols", () => {
    const { context, container } = setup();
    const tabA = {};
    const tabB = {};
    const [tab, setTab] = createAtom<object>(tabA);
    const node = render(
      branch(
        tab,
        [
          [tabA, "A"],
          [tabB, "B"],
        ],
        "fallback",
      ),
      context,
    );
    node.mount(container);

    expect(container.textContent).toBe("A");

    setTab(tabB);
    flushPendingUpdates();
    expect(container.textContent).toBe("B");

    setTab({});
    flushPendingUpdates();
    expect(container.textContent).toBe("fallback");
  });

  test("tuple keys use strict equality", () => {
    const { context, container } = setup();
    const [value, setValue] = createAtom<string | number>(1);
    const node = render(
      branch(value, [
        [1, "number"],
        ["1", "string"],
      ]),
      context,
    );
    node.mount(container);

    expect(container.textContent).toBe("number");

    setValue("1");
    flushPendingUpdates();
    expect(container.textContent).toBe("string");
  });

  test("unmounts the previous branch when switching", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "b">("a");
    const cleanup = vi.fn();

    function A(this: Context) {
      onCleanup(this, cleanup);
      return "A";
    }

    const node = render(branch(state, { a: createMarkup(A, {}), b: "B" }), context);
    node.mount(container);

    expect(container.textContent).toBe("A");
    expect(cleanup).not.toHaveBeenCalled();

    setState("b");
    flushPendingUpdates();

    expect(container.textContent).toBe("B");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("rebuilds a branch when switching back", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "b">("a");
    const node = render(branch(state, { a: createMarkup("span", { children: "A" }), b: "B" }), context);
    node.mount(container);

    const first = container.querySelector("span");

    setState("b");
    flushPendingUpdates();
    setState("a");
    flushPendingUpdates();

    expect(container.querySelector("span")).not.toBe(first);
    expect(container.textContent).toBe("A");
  });

  test("unmount disposes the active branch", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "b">("a");
    const aCleanup = vi.fn();
    const bCleanup = vi.fn();

    function A(this: Context) {
      onCleanup(this, aCleanup);
      return "A";
    }
    function B(this: Context) {
      onCleanup(this, bCleanup);
      return "B";
    }

    const node = render(branch(state, { a: createMarkup(A, {}), b: createMarkup(B, {}) }), context);
    node.mount(container);

    setState("b");
    flushPendingUpdates();

    node.unmount();

    expect(container.childNodes.length).toBe(0);
    expect(aCleanup).toHaveBeenCalledTimes(1);
    expect(bCleanup).toHaveBeenCalledTimes(1);
  });

  test("an undefined tuple case does not collide with the fallback", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<undefined | "other">(undefined);
    const node = render(
      branch(
        state,
        [[undefined, createMarkup("span", { children: "none" })]] as const,
        createMarkup("span", { children: "fallback" }),
      ),
      context,
    );
    node.mount(container);

    expect(container.textContent).toBe("none");

    setState("other");
    flushPendingUpdates();
    expect(container.textContent).toBe("fallback");

    setState(undefined);
    flushPendingUpdates();
    expect(container.textContent).toBe("none");
  });
});
