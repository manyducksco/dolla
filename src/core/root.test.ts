import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createContext } from "../core/context.js";
import { createRoot } from "./root.js";
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
});

async function waitFor(fn: () => boolean, timeout = 500) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 5));
  }
}
