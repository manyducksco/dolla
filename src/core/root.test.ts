import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addStore, createContext, onCleanup, onEffect } from "../core/context.js";
import { setErrorHandler, isSignalError } from "./errors.js";
import { compose, createAtom } from "./signals.js";
import { setSignalDebug } from "./signal-debug.js";
import { createRoot } from "./root.js";
import { flushPendingUpdates, scheduleUpdate, setUpdateStats } from "./markup/scheduler.js";
import { createRouter, Outlet } from "../router/router.js";
import { createMarkup } from "./markup/utils.js";
import { __dolla_export, __dolla_apply } from "./hmr.js";

describe("createRoot", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "test-root";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    setSignalDebug(false);
    setUpdateStats(false);
    vi.restoreAllMocks();
  });

  test("accepts an Element target", () => {
    const root = createRoot(container);
    expect(root).toBeDefined();
    expect(typeof root.mount).toBe("function");
    expect(typeof root.unmount).toBe("function");
    expect(typeof root.plugin).toBe("function");
  });

  test("accepts a CSS selector string target", () => {
    const root = createRoot("#test-root");
    expect(root).toBeDefined();
  });

  /** Mounts a view in `root` and returns the error thrown by a computed created in its body. */
  async function errorFromView(root: ReturnType<typeof createRoot>): Promise<Error> {
    let getter!: () => unknown;
    await root.mount(function DebugView() {
      getter = compose(() => {
        throw new Error("debug frame");
      });
      return null;
    });
    try {
      getter();
    } catch (error) {
      return error as Error;
    }
    throw new Error("did not throw");
  }

  function makeContainer() {
    const el = document.createElement("div");
    document.body.appendChild(el);
    return el;
  }

  test("debug mode records signal creation frames", async () => {
    const error = await errorFromView(createRoot(container, { debug: true }));
    expect(isSignalError(error)).toBe(true);
    expect(error.message).toContain("created at");
  });

  test("signals in a root without debug mode have no creation frames", async () => {
    const error = await errorFromView(createRoot(container));
    expect(error.message).not.toContain("created at");
  });

  test("creating a root without debug does not turn debug off for an earlier root", async () => {
    const other = makeContainer();
    const debugRoot = createRoot(container, { debug: true });
    const plainRoot = createRoot(other);

    expect((await errorFromView(debugRoot)).message).toContain("created at");
    expect((await errorFromView(plainRoot)).message).not.toContain("created at");

    plainRoot.unmount();
    other.remove();
  });

  test("creating a debug root does not turn debug on for an earlier root", async () => {
    const other = makeContainer();
    const plainRoot = createRoot(other);
    createRoot(container, { debug: true });

    expect((await errorFromView(plainRoot)).message).not.toContain("created at");

    plainRoot.unmount();
    other.remove();
  });

  test("signals created outside any root have no creation frames, even with a debug root", () => {
    createRoot(container, { debug: true });
    const getter = compose(() => {
      throw new Error("no context");
    });
    expect(() => getter()).toThrow(expect.objectContaining({ message: expect.not.stringContaining("created at") }));
  });

  test("a store added by a plugin records creation frames and is named after the store", async () => {
    const root = createRoot(container, { debug: true });
    let getter!: () => unknown;
    function SessionStore() {
      getter = compose(function session() {
        throw new Error("store frame");
      });
      return {};
    }
    root.plugin((ctx) => {
      addStore(ctx, SessionStore);
    });
    await root.mount(null);

    let message = "";
    try {
      getter();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("created at");
    expect(message).toContain('composed "SessionStore → session"');
  });

  test("debug mode enables slow-flush statistics for that root's updates", async () => {
    const root = createRoot(container, { debug: true });
    let ctx: any;
    root.plugin((c) => {
      ctx = c;
    });
    await root.mount(null);

    const now = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(20);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleUpdate(() => {}, { label: "debug flush", context: ctx });
    flushPendingUpdates();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("debug flush: 1");
  });

  test("slow updates from a root without debug mode are not reported", async () => {
    const other = makeContainer();
    // Created in this order, the old global flag would be on for both roots.
    const plainRoot = createRoot(other);
    const debugRoot = createRoot(container, { debug: true });
    let debugCtx: any;
    let plainCtx: any;
    debugRoot.plugin((c) => {
      debugCtx = c;
    });
    plainRoot.plugin((c) => {
      plainCtx = c;
    });
    await debugRoot.mount(null);
    await plainRoot.mount(null);

    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleUpdate(() => (time += 1), { label: "fast debug update", context: debugCtx });
    scheduleUpdate(() => (time += 50), { label: "slow plain update", context: plainCtx });
    flushPendingUpdates();

    expect(warn).not.toHaveBeenCalled();

    plainRoot.unmount();
    other.remove();
  });

  test("mount renders content into the target element", async () => {
    const root = createRoot(container);
    await root.mount("hello world");
    expect(container.textContent).toBe("hello world");
  });

  test("mount with markup renders into target", async () => {
    const root = createRoot(container);
    const { createMarkup } = await import("../core/markup/utils.js");
    await root.mount(createMarkup("span", { children: "marked up" }));
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("marked up");
  });

  test("unmount removes content", async () => {
    const root = createRoot(container);
    await root.mount("content");
    expect(container.textContent).toBe("content");
    root.unmount();
    expect(container.textContent).toBe("");
  });

  test("plugin is called during mount", async () => {
    const root = createRoot(container);
    const plugin = vi.fn(async () => {});
    root.plugin(plugin);
    await root.mount("hello");
    expect(plugin).toHaveBeenCalledTimes(1);
  });

  test("plugin receives context", async () => {
    const root = createRoot(container);
    let receivedContext: any;
    root.plugin(async (ctx) => {
      receivedContext = ctx;
    });
    await root.mount("hello");
    expect(receivedContext).toBeDefined();
    expect(receivedContext.name).toBe("dolla:root");
  });

  test("multiple plugins execute in order", async () => {
    const root = createRoot(container);
    const order: number[] = [];
    root.plugin(async () => { order.push(1); });
    root.plugin(async () => { order.push(2); });
    await root.mount("hello");
    expect(order).toEqual([1, 2]);
  });

  test("plugin returning a promise delays mount", async () => {
    const root = createRoot(container);
    let pluginDone = false;
    root.plugin(async () => {
      await new Promise((r) => setTimeout(r, 10));
      pluginDone = true;
    });
    await root.mount("hello");
    expect(pluginDone).toBe(true);
  });

  test("plugin is chainable", () => {
    const root = createRoot(container);
    const result = root.plugin(async () => {});
    expect(result).toBe(root);
  });

  test("double mount is a no-op", async () => {
    const root = createRoot(container);
    await root.mount("first");
    await root.mount("second");
    expect(container.textContent).toBe("first");
  });

  test("concurrent mounts render once", async () => {
    const root = createRoot(container);
    const plugin = vi.fn(async () => {});
    root.plugin(plugin);
    const view = vi.fn(function (this: any) {
      return "once";
    });
    await Promise.all([root.mount(view), root.mount(view)]);
    expect(view).toHaveBeenCalledTimes(1);
    expect(plugin).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("once");
  });

  test("double unmount is a no-op", async () => {
    const root = createRoot(container);
    await root.mount("hello");
    root.unmount();
    root.unmount();
    expect(container.textContent).toBe("");
  });

  test("mount with View function renders view", async () => {
    const root = createRoot(container);
    const view = vi.fn(function (this: any) {
      return "from view";
    });
    await root.mount(view);
    expect(container.textContent).toBe("from view");
  });

  test("unmount after mount with view cleans up", async () => {
    const root = createRoot(container);
    const view = vi.fn(function (this: any) {
      return "view content";
    });
    await root.mount(view);
    expect(container.textContent).toBe("view content");
    root.unmount();
    expect(container.textContent).toBe("");
  });

  test("repeated HMR-style full-reload cycle leaves a single page instance", async () => {
    // Mirrors the reported bug: a full app reload (unmount + fresh mount) on
    // every save must not stack duplicate copies of the current route in #app.
    const Page: any = vi.fn(function () {
      return createMarkup("main", { class: "page", children: "PAGE" });
    });

    let current = createRoot(container);
    current.plugin(createRouter({ routes: [{ path: "/", view: Page }] }));
    await current.mount(Outlet);
    await waitFor(() => container.querySelectorAll(".page").length === 1);

    for (let i = 0; i < 4; i++) {
      current.unmount();
      const next = createRoot(container);
      next.plugin(createRouter({ routes: [{ path: "/", view: Page }] }));
      await next.mount(Outlet);
      current = next;
      // Invariant: never more than one page instance, even mid-cycle.
      await waitFor(() => container.querySelectorAll(".page").length === 1);
    }

    expect(container.querySelectorAll(".page")).toHaveLength(1);
    expect(container.textContent).toBe("PAGE");
  });

  test("in-place HMR replace of a page leaves a single instance", async () => {
    // With the entry self-accepting, an update to a nested module resolves via
    // `__dolla_apply` (replaceView in place) rather than a full reload. This
    // must produce exactly one page instance with the new content.
    const Page: any = __dolla_export("root.test:Page", function Page() {
      return createMarkup("main", { class: "page", children: "PAGE v1" });
    });

    const root = createRoot(container);
    root.plugin(createRouter({ routes: [{ path: "/", view: Page }] }));
    await root.mount(Outlet);
    await waitFor(() => container.querySelectorAll(".page").length === 1);

    expect(container.querySelectorAll(".page")).toHaveLength(1);
    expect(container.textContent).toBe("PAGE v1");

    // Simulate the HMR cascade replacing the page view with a new impl.
    const newPage = __dolla_export("root.test:Page", function Page() {
      return createMarkup("main", { class: "page", children: "PAGE v2" });
    });
    __dolla_apply({ Page: newPage }, { Page });

    expect(container.querySelectorAll(".page")).toHaveLength(1);
    expect(container.textContent).toBe("PAGE v2");
  });

  test("fresh root into an element already hosting a dolla root replaces it (no duplicate)", async () => {
    // Simulates a full HMR reload where the entry re-runs but the previous
    // instance is never disposed (its `root.unmount` is never called). The new
    // root must tear down the stale DOM instead of stacking a duplicate — this
    // is exactly the duplicated-Workspace symptom.
    const Page = vi.fn(function () {
      return createMarkup("main", { class: "page", children: "PAGE" });
    });

    const first = createRoot(container);
    first.plugin(createRouter({ routes: [{ path: "/", view: Page }] }));
    await first.mount(Outlet);
    await waitFor(() => container.querySelectorAll(".page").length === 1);

    // Intentionally NOT calling `first.unmount()` — mimics a dispose-less reload.
    const second = createRoot(container);
    second.plugin(createRouter({ routes: [{ path: "/", view: Page }] }));
    await second.mount(Outlet);
    await waitFor(() => container.querySelectorAll(".page").length === 1);

    expect(container.querySelectorAll(".page")).toHaveLength(1);
    expect(container.textContent).toBe("PAGE");
  });

  test("fresh root into an element already hosting a dolla root cleans up the old root's context", async () => {
    const cleanupSpy = vi.fn();
    const first = createRoot(container);
    first.plugin((ctx) => {
      onCleanup(ctx, cleanupSpy);
    });
    await first.mount("first");

    const second = createRoot(container);
    await second.mount("second");

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("second");
  });

  test("onError receives errors from effects in mounted views", async () => {
    const errors: any[] = [];
    const [count, setCount] = createAtom(0);

    const App = function (this: any) {
      onEffect(this, () => {
        if (count() === 1) throw new Error("effect boom");
      });
      return "app";
    };

    const root = createRoot(container, { onError: (error) => errors.push(error) });
    await root.mount(App);

    expect(() => setCount(1)).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("effect boom");
    expect(errors[0].contextName).toContain("App");

    root.unmount();
  });

  test("effect errors during mount do not reject mount when handled", async () => {
    const errors: any[] = [];

    const App = function (this: any) {
      onEffect(this, () => {
        throw new Error("mount effect boom");
      });
      return "app";
    };

    const root = createRoot(container, { onError: (error) => errors.push(error) });
    await expect(root.mount(App)).resolves.toBeUndefined();

    expect(container.textContent).toBe("app");
    expect(errors).toHaveLength(1);

    root.unmount();
  });

  test("unmount continues after a cleanup error", async () => {
    const errors: any[] = [];
    let secondCleanupRan = false;

    const App = function (this: any) {
      onCleanup(this, () => {
        throw new Error("cleanup boom");
      });
      onCleanup(this, () => {
        secondCleanupRan = true;
      });
      return "app";
    };

    const root = createRoot(container, { onError: (error) => errors.push(error) });
    await root.mount(App);

    expect(() => root.unmount()).not.toThrow();
    expect(secondCleanupRan).toBe(true);
    expect(errors).toHaveLength(1);
    expect(container.textContent).toBe("");
  });

  test("uses the default reporter when no onError is configured", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const [count, setCount] = createAtom(0);

    const App = function (this: any) {
      onEffect(this, () => {
        if (count() === 1) throw new Error("unhandled effect boom");
      });
      return "app";
    };

    const root = createRoot(container);
    await root.mount(App);
    setCount(1);

    expect(consoleError).toHaveBeenCalledTimes(1);

    root.unmount();
    consoleError.mockRestore();
  });

  test("root onError takes precedence over the internals fallback", async () => {
    const globalErrors: any[] = [];
    const rootErrors: any[] = [];
    setErrorHandler((error) => globalErrors.push(error));

    const [count, setCount] = createAtom(0);
    const App = function (this: any) {
      onEffect(this, () => {
        if (count() === 1) throw new Error("boom");
      });
      return "app";
    };

    const root = createRoot(container, { onError: (error) => rootErrors.push(error) });
    await root.mount(App);
    setCount(1);

    expect(rootErrors).toHaveLength(1);
    expect(globalErrors).toHaveLength(0);

    root.unmount();
    setErrorHandler(null);
  });
});

async function waitFor(fn: () => boolean, timeout = 500) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}
