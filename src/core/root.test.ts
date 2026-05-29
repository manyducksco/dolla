import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createContext } from "../core/context.js";
import { createRoot } from "./root.js";

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
});
