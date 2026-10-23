import { describe, expect, test, vi } from "vitest";
import type { Context } from "../../context.js";
import { createContext, onCleanup } from "../../context.js";
import { createAtom } from "../../signals.js";
import { isSuspended, onResume, onSuspend } from "../../suspend.js";
import { flushPendingUpdates } from "../scheduler.js";
import { createPortal, forEach, hideIf, keepAlive, showIf } from "../helpers.js";
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

  test("onSuspend and onResume run while DOM is still/again attached", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    let el: HTMLElement | null = null;
    const suspend = vi.fn();
    const resume = vi.fn();

    function Hooked(this: Context) {
      onSuspend(this, () => suspend(el?.parentNode === container, isSuspended(this)));
      onResume(this, () => resume(el?.parentNode === container, isSuspended(this)));
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

    setCond(false);
    flushPendingUpdates();
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledWith(true, true);
    expect(resume).not.toHaveBeenCalled();

    setCond(true);
    flushPendingUpdates();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledWith(true, false);
  });

  test("hooks fire for content created while the branch is suspended", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(false);
    const suspend = vi.fn();

    function Later(this: Context) {
      onSuspend(this, () => suspend(isSuspended(this)));
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

    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledWith(true);
    expect(container.textContent).toBe("");
  });

  test("a dynamic subtree can structurally update while parked", () => {
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

  test("a repeat node can update while parked", () => {
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

  test("suspends and resumes portal content", () => {
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

  test("suspends portals inside a non-keepAlive child of a keepAlive side", () => {
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

  test("outer suspension reaches keep-alive content in a nested branch", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(true);
    const suspend = vi.fn();
    const resume = vi.fn();

    function Inner(this: Context) {
      onSuspend(this, suspend);
      onResume(this, resume);
      return "inner";
    }

    const innerContent = showIf(inner, keepAlive(createMarkup(Inner, {})), "other");
    const node = render(showIf(outer, keepAlive(innerContent)), context);
    node.mount(container);
    expect(container.textContent).toBe("inner");

    setOuter(false);
    flushPendingUpdates();
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");

    setOuter(true);
    flushPendingUpdates();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("inner");
  });

  test("does not resume an inner parked side when the outer branch resumes", () => {
    const { context, container } = setup();
    const [outer, setOuter] = createAtom(true);
    const [inner, setInner] = createAtom(true);
    const aResume = vi.fn();
    const bResume = vi.fn();

    function A(this: Context) {
      onResume(this, aResume);
      return "A";
    }
    function B(this: Context) {
      onResume(this, bResume);
      return "B";
    }

    const innerContent = showIf(inner, keepAlive(createMarkup(A, {})), keepAlive(createMarkup(B, {})));
    const node = render(showIf(outer, keepAlive(innerContent)), context);
    node.mount(container);
    expect(container.textContent).toBe("A");

    // Park the whole outer branch.
    setOuter(false);
    flushPendingUpdates();

    // Flip the inner branch while everything is suspended.
    setInner(false);
    flushPendingUpdates();
    expect(bResume).not.toHaveBeenCalled();
    expect(aResume).not.toHaveBeenCalled();

    // Resuming the outer branch should only resume B (the active inner side).
    setOuter(true);
    flushPendingUpdates();
    expect(container.textContent).toBe("B");
    expect(bResume).toHaveBeenCalledTimes(1);
    expect(aResume).not.toHaveBeenCalled();
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

  test("keepAlive is inert outside a suspend-aware owner", () => {
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

  test("unmount disposes both active and parked sides", () => {
    const { context, container } = setup();
    const [cond, setCond] = createAtom(true);
    const activeCleanup = vi.fn();
    const parkedCleanup = vi.fn();

    function Active(this: Context) {
      onCleanup(this, activeCleanup);
      return "active";
    }
    function Parked(this: Context) {
      onCleanup(this, parkedCleanup);
      return "parked";
    }

    const node = render(
      showIf(cond, keepAlive(createMarkup(Active, {})), keepAlive(createMarkup(Parked, {}))),
      context,
    );
    node.mount(container);
    expect(container.textContent).toBe("active");

    setCond(false);
    flushPendingUpdates();
    expect(container.textContent).toBe("parked");

    node.unmount();
    expect(container.childNodes.length).toBe(0);
    expect(activeCleanup).toHaveBeenCalledTimes(1);
    expect(parkedCleanup).toHaveBeenCalledTimes(1);
  });

  test("HMR can replace a view while it is parked", () => {
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
    const suspend = vi.fn();
    const resume = vi.fn();

    function Hooked(this: Context) {
      onSuspend(this, suspend);
      onResume(this, resume);
      return "hooked";
    }

    const node = render(showIf(cond, keepAlive(createMarkup(Hooked, {}))), context);
    node.mount(container);
    node.unmount();

    setCond(false);
    flushPendingUpdates();
    expect(suspend).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
  });

  test("a parked branch can be moved to a new parent", () => {
    const { context, container } = setup();
    const other = document.createElement("div");
    const [cond, setCond] = createAtom(true);

    const node = new BranchNode(context, cond, keepAlive("moved"), undefined);
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
});
