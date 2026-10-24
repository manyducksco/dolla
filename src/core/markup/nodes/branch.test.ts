import { describe, expect, test, vi } from "vitest";
import { type Context, createContext, onCleanup } from "../../context.js";
import { createAtom } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { branch } from "../helpers.js";
import { createMarkup, render } from "../utils.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

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
