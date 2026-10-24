import { describe, expect, test, vi } from "vitest";
import type { Context } from "../../context.js";
import { createContext, isMounted, onCleanup, onMount } from "../../context.js";
import { createAtom } from "../../signals.js";
import { isVisible, onHide, onShow } from "../../visibility.js";
import { flushPendingUpdates } from "../scheduler.js";
import { branch, createPortal, forEach, hideIf, keepAlive, showIf } from "../helpers.js";
import { createMarkup, render } from "../utils.js";
import { BranchNode } from "./branch.js";
import { ViewNode } from "./view.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

describe("keepAlive in showIf", () => {
  test("preserves DOM identity and input value across hide/show", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const node = render(showIf(cond, keepAlive(createMarkup("input", {}))), context);
    node.mount(container);

    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = "typed";

    setCond(false);
    flushPendingUpdates();
    expect(container.querySelector("input")).toBeNull();

    setCond(true);
    flushPendingUpdates();
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed");
  });

  test("does not re-run the view body when hidden and shown again", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const view = vi.fn(function (this: Context) {
      return createMarkup("span", { children: "once" });
    });

    const node = render(showIf(cond, keepAlive(createMarkup(view, {}))), context);
    node.mount(container);
    expect(view).toHaveBeenCalledTimes(1);

    setCond(false);
    flushPendingUpdates();
    setCond(true);
    flushPendingUpdates();
    setCond(false);
    flushPendingUpdates();
    setCond(true);
    flushPendingUpdates();

    expect(view).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("span").length).toBe(1);
  });

  test("effects keep running and update detached DOM while hidden", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const [count, setCount] = createAtom(0);

    function Counter() {
      return createMarkup("span", { children: count });
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Counter, {}))), context);
    node.mount(container);

    const span = container.querySelector("span")!;
    expect(span.textContent).toBe("0");

    setCond(false);
    flushPendingUpdates();
    expect(span.parentNode).not.toBe(container);

    setCount(1);
    flushPendingUpdates();
    expect(span.textContent).toBe("1");

    setCond(true);
    flushPendingUpdates();
    expect(container.querySelector("span")).toBe(span);
    expect(span.textContent).toBe("1");
  });

  test("onCleanup only runs when the owner unmounts", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const cleanup = vi.fn();

    function Cached(this: Context) {
      onCleanup(this, cleanup);
      return "cached";
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Cached, {}))), context);
    node.mount(container);

    setCond(false);
    flushPendingUpdates();
    expect(cleanup).not.toHaveBeenCalled();

    setCond(true);
    flushPendingUpdates();
    expect(cleanup).not.toHaveBeenCalled();

    node.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("onShow and onHide run while DOM is still/again attached", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    let el: HTMLElement | null = null;
    const show = vi.fn();
    const hide = vi.fn();

    function Hooked(this: Context) {
      onShow(this, () => show(el?.parentNode === container, isVisible(this)));
      onHide(this, () => hide(el?.parentNode === container, isVisible(this)));
      return createMarkup("span", {
        ref: (node: HTMLElement) => {
          el = node;
          return () => {};
        },
        children: "hooked",
      });
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Hooked, {}))), context);
    node.mount(container);

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith(true, true);

    setCond(false);
    flushPendingUpdates();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledWith(true, false);

    setCond(true);
    flushPendingUpdates();
    expect(show).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenLastCalledWith(true, true);
  });

  test("content created while hidden gets no visibility hooks until shown", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(false);
    const show = vi.fn();
    const hide = vi.fn();

    function Later(this: Context) {
      onShow(this, show);
      onHide(this, hide);
      return "created later";
    }

    const content = () => showIf(inner, createMarkup(Later, {}));
    const node = render(showIf(outer, keepAlive(content)), context);
    node.mount(container);

    setOuter(false);
    flushPendingUpdates();
    expect(container.textContent).toBe("");

    setInner(true);
    flushPendingUpdates();

    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");

    setOuter(true);
    flushPendingUpdates();
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
  });

  test("a dynamic subtree can structurally update while hidden", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const [pick, setPick] = createAtom<"a" | "b">("a");

    const content = () => createMarkup("span", { children: pick() });
    const node = render(showIf(cond, keepAlive(content)), context);
    node.mount(container);
    expect(container.textContent).toBe("a");

    setCond(false);
    flushPendingUpdates();
    setPick("b");
    flushPendingUpdates();

    setCond(true);
    flushPendingUpdates();
    expect(container.textContent).toBe("b");
  });

  test("a repeat node can update while hidden", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const [items, setItems] = createAtom(["a"]);

    const content = () =>
      forEach(
        items,
        (item) => item,
        (item) => createMarkup("span", { children: item }),
      );
    const node = render(showIf(cond, keepAlive(content)), context);
    node.mount(container);
    expect(container.querySelectorAll("span").length).toBe(1);

    setCond(false);
    flushPendingUpdates();
    setItems(["a", "b"]);
    flushPendingUpdates();

    setCond(true);
    flushPendingUpdates();
    expect(container.querySelectorAll("span").length).toBe(2);
    expect(container.textContent).toBe("ab");
  });

  test("hides and shows portal content", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const target = document.createElement("div");

    const node = render(showIf(cond, keepAlive(createPortal(target, "portaled"))), context);
    node.mount(container);
    expect(target.textContent).toBe("portaled");

    setCond(false);
    flushPendingUpdates();
    expect(target.textContent).toBe("");
    expect(container.textContent).toBe("");

    setCond(true);
    flushPendingUpdates();
    expect(target.textContent).toBe("portaled");
  });

  test("hides portals inside a non-keepAlive child of a keepAlive side", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner] = createAtom(true);
    const target = document.createElement("div");

    const innerContent = showIf(inner, createPortal(target, "nested"), "other");
    const node = render(showIf(outer, keepAlive(innerContent)), context);
    node.mount(container);
    expect(target.textContent).toBe("nested");

    setOuter(false);
    flushPendingUpdates();
    expect(target.textContent).toBe("");

    setOuter(true);
    flushPendingUpdates();
    expect(target.textContent).toBe("nested");
  });

  test("hideIf supports keepAlive on its content side", () => {
    const { context, container } = setup();
    const [loading, setLoading] = createAtom(true);

    const node = render(
      hideIf(
        loading,
        keepAlive(createMarkup("span", { children: "content" })),
        createMarkup("span", { children: "loading" }),
      ),
      context,
    );
    node.mount(container);
    expect(container.textContent).toBe("loading");

    setLoading(false);
    flushPendingUpdates();
    const content = container.querySelector("span");
    expect(container.textContent).toBe("content");

    setLoading(true);
    flushPendingUpdates();
    expect(container.textContent).toBe("loading");

    setLoading(false);
    flushPendingUpdates();
    expect(container.querySelector("span")).toBe(content);
    expect(container.textContent).toBe("content");
  });

  test("outer hide reaches keep-alive content in a nested branch", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(true);
    const show = vi.fn();
    const hide = vi.fn();

    function Inner(this: Context) {
      onShow(this, show);
      onHide(this, hide);
      return "inner";
    }

    const innerContent = showIf(inner, keepAlive(createMarkup(Inner, {})), "other");
    const node = render(showIf(outer, keepAlive(innerContent)), context);
    node.mount(container);
    expect(container.textContent).toBe("inner");
    expect(show).toHaveBeenCalledTimes(1);

    setOuter(false);
    flushPendingUpdates();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("");

    setOuter(true);
    flushPendingUpdates();
    expect(show).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("inner");
  });

  test("does not show an inner hidden side when the outer branch shows", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(true);
    const aShow = vi.fn();
    const aHide = vi.fn();
    const bShow = vi.fn();
    const bHide = vi.fn();

    function A(this: Context) {
      onShow(this, aShow);
      onHide(this, aHide);
      return "A";
    }
    function B(this: Context) {
      onShow(this, bShow);
      onHide(this, bHide);
      return "B";
    }

    const innerContent = showIf(inner, keepAlive(createMarkup(A, {})), keepAlive(createMarkup(B, {})));
    const node = render(showIf(outer, keepAlive(innerContent)), context);
    node.mount(container);
    expect(container.textContent).toBe("A");
    expect(aShow).toHaveBeenCalledTimes(1);

    // Hide the whole outer branch.
    setOuter(false);
    flushPendingUpdates();
    expect(aHide).toHaveBeenCalledTimes(1);

    // Flip the inner branch while everything is hidden.
    setInner(false);
    flushPendingUpdates();
    expect(bShow).not.toHaveBeenCalled();
    expect(bHide).not.toHaveBeenCalled();

    // Showing the outer branch should only show B (the active inner side).
    setOuter(true);
    flushPendingUpdates();
    expect(container.textContent).toBe("B");
    expect(bShow).toHaveBeenCalledTimes(1);
    expect(aShow).toHaveBeenCalledTimes(1);
    expect(aHide).toHaveBeenCalledTimes(1);
  });

  test("rapid condition flips coalesce to the final side", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const node = render(showIf(cond, keepAlive(createMarkup("span", { children: "kept" }))), context);
    node.mount(container);
    const span = container.querySelector("span");

    setCond(false);
    setCond(true);
    setCond(false);
    setCond(true);
    flushPendingUpdates();

    expect(container.querySelector("span")).toBe(span);
    expect(container.textContent).toBe("kept");
  });

  test("keepAlive is inert outside a helper that supports it", () => {
    const { context, container } = setup();
    const node = render(keepAlive("plain"), context);
    node.mount(container);
    expect(container.textContent).toBe("plain");
  });

  test("keepAlive on a static condition renders normally", () => {
    const { context, container } = setup();
    const node = render(showIf(true, keepAlive("static")), context);
    node.mount(container);
    expect(container.textContent).toBe("static");
  });

  test("nested keepAlive markers are unwrapped", () => {
    const { context, container } = setup();
    const [cond] = createAtom(true);
    const node = render(showIf(cond, keepAlive([keepAlive("a"), "b"])), context);
    node.mount(container);
    expect(container.textContent).toBe("ab");
  });

  test("non-keepAlive sides still rebuild their DOM", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const node = render(showIf(cond, createMarkup("span", { children: "fresh" })), context);
    node.mount(container);

    const first = container.querySelector("span");
    setCond(false);
    flushPendingUpdates();
    setCond(true);
    flushPendingUpdates();

    expect(container.querySelector("span")).not.toBe(first);
  });

  test("unmount disposes both active and hidden sides", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const activeCleanup = vi.fn();
    const hiddenCleanup = vi.fn();

    function Active(this: Context) {
      onCleanup(this, activeCleanup);
      return "active";
    }
    function Hidden(this: Context) {
      onCleanup(this, hiddenCleanup);
      return "hidden";
    }

    const node = render(
      showIf(cond, keepAlive(createMarkup(Active, {})), keepAlive(createMarkup(Hidden, {}))),
      context,
    );
    node.mount(container);
    expect(container.textContent).toBe("active");

    setCond(false);
    flushPendingUpdates();
    expect(container.textContent).toBe("hidden");

    node.unmount();
    expect(container.childNodes.length).toBe(0);
    expect(activeCleanup).toHaveBeenCalledTimes(1);
    expect(hiddenCleanup).toHaveBeenCalledTimes(1);
  });

  test("HMR can replace a view while it is hidden", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);

    function A() {
      return "a";
    }
    function B() {
      return "b";
    }

    const view = new ViewNode(context, A, {});
    const node = render(showIf(cond, keepAlive(view)), context);
    node.mount(container);
    expect(container.textContent).toBe("a");

    setCond(false);
    flushPendingUpdates();

    view.replaceView(B);

    setCond(true);
    flushPendingUpdates();
    expect(container.textContent).toBe("b");
  });

  test("hooks do not fire after the owner is disposed", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const show = vi.fn();
    const hide = vi.fn();

    function Hooked(this: Context) {
      onShow(this, show);
      onHide(this, hide);
      return "hooked";
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Hooked, {}))), context);
    node.mount(container);
    expect(show).toHaveBeenCalledTimes(1);

    node.unmount();
    expect(hide).toHaveBeenCalledTimes(1);

    setCond(false);
    flushPendingUpdates();
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledTimes(1);
  });

  test("a hidden branch can be moved to a new parent", () => {
    const { context, container } = setup();
    const other = document.createElement("div");
    const [cond, setCond] = createAtom(true);

    const node = new BranchNode(
      context,
      () => (cond() ? "truthy" : "falsy"),
      [
        ["truthy", keepAlive("moved")],
        ["falsy", undefined],
      ],
      undefined,
    );
    node.mount(container);
    expect(container.textContent).toBe("moved");

    setCond(false);
    flushPendingUpdates();
    expect(container.textContent).toBe("");

    node.move(other);
    setCond(true);
    flushPendingUpdates();

    expect(container.textContent).toBe("");
    expect(other.textContent).toBe("moved");
  });

  test("isMounted stays true while hidden; isVisible does not", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    let viewContext: Context | undefined;

    function Hooked(this: Context) {
      viewContext = this;
      return "hooked";
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Hooked, {}))), context);
    node.mount(container);

    expect(isMounted(viewContext!)).toBe(true);
    expect(isVisible(viewContext!)).toBe(true);

    setCond(false);
    flushPendingUpdates();
    expect(isMounted(viewContext!)).toBe(true);
    expect(isVisible(viewContext!)).toBe(false);

    setCond(true);
    flushPendingUpdates();
    expect(isVisible(viewContext!)).toBe(true);

    node.unmount();
    expect(isMounted(viewContext!)).toBe(false);
    expect(isVisible(viewContext!)).toBe(false);
  });

  test("onMount runs before onShow, and onHide before onCleanup", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const events: string[] = [];

    function Hooked(this: Context) {
      onMount(this, () => events.push("mount"));
      onShow(this, () => events.push("show"));
      onHide(this, () => events.push("hide"));
      onCleanup(this, () => events.push("cleanup"));
      return "hooked";
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Hooked, {}))), context);
    node.mount(container);
    expect(events).toEqual(["mount", "show"]);

    setCond(false);
    flushPendingUpdates();
    expect(events).toEqual(["mount", "show", "hide"]);

    setCond(true);
    flushPendingUpdates();
    expect(events).toEqual(["mount", "show", "hide", "show"]);

    node.unmount();
    expect(events).toEqual(["mount", "show", "hide", "show", "hide", "cleanup"]);
  });

  test("unmounting while hidden skips onHide and runs onCleanup", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const events: string[] = [];

    function Hooked(this: Context) {
      onShow(this, () => events.push("show"));
      onHide(this, () => events.push("hide"));
      onCleanup(this, () => events.push("cleanup"));
      return "hooked";
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Hooked, {}))), context);
    node.mount(container);
    expect(events).toEqual(["show"]);

    setCond(false);
    flushPendingUpdates();
    expect(events).toEqual(["show", "hide"]);

    node.unmount();
    expect(events).toEqual(["show", "hide", "cleanup"]);
  });

  test("unmounting content that was only ever hidden skips onHide", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(false);
    const show = vi.fn();
    const hide = vi.fn();
    const cleanup = vi.fn();

    function Later(this: Context) {
      onShow(this, show);
      onHide(this, hide);
      onCleanup(this, cleanup);
      return "later";
    }

    const content = () => showIf(inner, createMarkup(Later, {}));
    const node = render(showIf(outer, keepAlive(content)), context);
    node.mount(container);

    setOuter(false);
    flushPendingUpdates();
    setInner(true);
    flushPendingUpdates();

    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();

    node.unmount();
    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test("visibility hooks work outside keepAlive", () => {
    const { context, container } = setup();
    const events: string[] = [];

    function Hooked(this: Context) {
      onShow(this, () => events.push("show"));
      onHide(this, () => events.push("hide"));
      onCleanup(this, () => events.push("cleanup"));
      return "hooked";
    }

    const node = render(createMarkup(Hooked, {}), context);
    node.mount(container);
    expect(events).toEqual(["show"]);

    node.unmount();
    expect(events).toEqual(["show", "hide", "cleanup"]);
  });
});

describe("branch", () => {
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

  test("keepAlive preserves branch content across several switches", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "b" | "c">("a");
    const node = render(
      branch(
        state,
        {
          a: keepAlive(createMarkup("input", {})),
          b: keepAlive(createMarkup("span", { children: "B" })),
          c: keepAlive(createMarkup("span", { children: "C" })),
        },
        keepAlive(createMarkup("span", { children: "fallback" })),
      ),
      context,
    );
    node.mount(container);

    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "typed";

    setState("b");
    flushPendingUpdates();
    const b = container.querySelector("span");
    expect(container.textContent).toBe("B");

    setState("c");
    flushPendingUpdates();
    expect(container.textContent).toBe("C");

    setState("a");
    flushPendingUpdates();
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("typed");

    setState("b");
    flushPendingUpdates();
    expect(container.querySelector("span")).toBe(b);
  });

  test("unmount disposes every retained branch", () => {
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

    const node = render(
      branch(state, {
        a: keepAlive(createMarkup(A, {})),
        b: keepAlive(createMarkup(B, {})),
      }),
      context,
    );
    node.mount(container);

    setState("b");
    flushPendingUpdates();

    node.unmount();
    expect(container.childNodes.length).toBe(0);
    expect(aCleanup).toHaveBeenCalledTimes(1);
    expect(bCleanup).toHaveBeenCalledTimes(1);
  });

  test("a keepAlive fallback is retained when cases match again", () => {
    const { context, container } = setup();
    const [state, setState] = createAtom<"a" | "missing">("missing");
    const node = render(branch(state, { a: "A" }, keepAlive(createMarkup("input", {}))), context);
    node.mount(container);

    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "fallback state";

    setState("a");
    flushPendingUpdates();
    expect(container.textContent).toBe("A");

    setState("missing");
    flushPendingUpdates();
    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("fallback state");
  });
});
