import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context, createContext, mountContext } from "../core/context.js";
import { DollaPlugin } from "../core/index.js";
import { ViewNode } from "../core/markup/nodes/view.js";
import { PARENT_ELEMENT } from "../core/symbols.js";

import { createRouter, lazy, Outlet, RedirectError } from "./router.js";
import { getRouter } from "./store.js";

async function withRouter(plugin: DollaPlugin, callback: (context: Context) => any) {
  const context = createContext(null, {
    name: "test-router",
    [PARENT_ELEMENT]: document.body,
  });

  await plugin(context);

  mountContext(context);

  const node = new ViewNode(context, Outlet, {});

  node.mount(document.body);

  await callback(node.context);

  node.unmount();
}

describe("Router Engine", () => {
  beforeEach(() => {
    // Reset JSDOM history before each test
    window.history.replaceState(null, "", "/");
  });

  it("resolves nested layers and merges meta data", async () => {
    const RootView = () => {};
    const ChildView = () => {};

    const router = createRouter({
      routes: [
        {
          path: "/",
          view: RootView,
          meta: { requiresAuth: false, potato: 5 },
          routes: [
            {
              path: "/dashboard",
              view: ChildView,
              meta: { requiresAuth: true, title: "Dashboard" },
            },
          ],
        },
      ],
    });

    await withRouter(router, async (context) => {
      // Push new route and wait for microtasks (updateRoute execution)
      window.history.pushState(null, "", "/dashboard");
      window.dispatchEvent(new Event("popstate"));
      await Promise.resolve();

      const store = getRouter(context);

      expect(store.path()).toBe("/dashboard");
      expect(store.meta()).toEqual({
        // Overwritten:
        requiresAuth: true,

        // Added:
        title: "Dashboard",

        // Inherited:
        potato: 5,
      });
    });
  });

  it("executes preload functions and maps data to views", async () => {
    const preloadSpy = vi.fn().mockResolvedValue({ user: "Alice" });
    let capturedProps: any;

    const router = createRouter({
      routes: [
        {
          path: "/profile",
          preload: preloadSpy,
          view: (props) => {
            capturedProps = props;
            return null;
          },
        },
      ],
    });

    await withRouter(router, async (context) => {
      window.history.pushState(null, "", "/profile");
      window.dispatchEvent(new Event("popstate"));

      // Allow promises to flush
      await new Promise(process.nextTick);

      expect(preloadSpy).toHaveBeenCalled();
      expect(capturedProps.data).toEqual({ user: "Alice" });
    });
  });

  it("handles RedirectError gracefully", async () => {
    const router = createRouter({
      routes: [
        { path: "/login", view: () => {} },
        {
          path: "/protected",
          view: () => {},
          preload: () => {
            throw new RedirectError("/login");
          },
        },
      ],
    });

    await withRouter(router, async (context) => {
      window.history.pushState(null, "", "/protected");
      window.dispatchEvent(new Event("popstate"));

      // Use macrotask to ensure all async route resolution completes
      await new Promise((resolve) => setTimeout(resolve, 0));

      const store = getRouter(context);
      expect(store.path()).toBe("/login");
    });
  });

  it("blocks navigation if guard returns false", async () => {
    const router = createRouter({
      routes: [
        { path: "/", view: () => {} },
        { path: "/form", view: () => {} },
      ],
    });

    await withRouter(router, async (context) => {
      const store = getRouter(context);

      store.push("/form");
      await new Promise(process.nextTick);

      // Add a blocker
      const unblock = store.block(() => true);

      // Attempt to navigate away
      store.push("/");
      await new Promise(process.nextTick);

      // Navigation should have failed
      expect(store.path()).toBe("/form");

      // Remove blocker and try again
      unblock();
      store.push("/");
      await new Promise(process.nextTick);

      expect(store.path()).toBe("/");
    });
  });

  it("updates query parameters reactively without unmounting", async () => {
    const router = createRouter({
      routes: [{ path: "/search", view: () => {} }],
    });

    await withRouter(router, async (context) => {
      window.history.pushState(null, "", "/search");
      window.dispatchEvent(new Event("popstate"));
      await new Promise(process.nextTick);

      const store = getRouter(context);

      store.setQuery({ q: "potato", sort: "asc" });

      expect(store.query()).toEqual({ q: "potato", sort: "asc" });
      expect(window.location.search).toBe("?q=potato&sort=asc");
    });
  });
});

describe("Router Engine - Lazy Loading", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("resolves a lazy loaded component successfully", async () => {
    const MockView = () => {};
    // Simulate `() => import("./View.js")`
    const loaderSpy = vi.fn().mockResolvedValue({ default: MockView });

    const router = createRouter({
      routes: [{ path: "/async", view: lazy(loaderSpy) }],
    });

    await withRouter(router, async (context) => {
      window.history.pushState(null, "", "/async");
      window.dispatchEvent(new Event("popstate"));

      // Flush promises
      await new Promise(process.nextTick);

      expect(loaderSpy).toHaveBeenCalledOnce();
    });
  });

  it("caches the lazy loaded component after the first fetch", async () => {
    const MockView = () => {};
    const loaderSpy = vi.fn().mockResolvedValue({ default: MockView });
    const lazyRoute = { path: "/async", view: lazy(loaderSpy) };

    const router = createRouter({
      routes: [{ path: "/", view: () => {} }, lazyRoute],
    });

    await withRouter(router, async (context) => {
      // First visit: triggers network request
      window.history.pushState(null, "", "/async");
      window.dispatchEvent(new Event("popstate"));

      // Use macrotask to ensure async route resolution and lazy load .then() callbacks complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(loaderSpy).toHaveBeenCalledTimes(1);

      // Navigate away
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new Event("popstate"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Second visit: should use cached view, no network request
      window.history.pushState(null, "", "/async");
      window.dispatchEvent(new Event("popstate"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Loader should still only have been called once
      expect(loaderSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("catches lazy load failures and triggers errorView", async () => {
    const loaderSpy = vi.fn().mockRejectedValue(new Error("Chunk failed to load"));
    let capturedError: Error | undefined;

    const router = createRouter({
      routes: [
        {
          path: "/async-fail",
          view: lazy(loaderSpy),
          errorView: (props) => {
            capturedError = props.error;
            return null;
          },
        },
      ],
    });

    await withRouter(router, async (context) => {
      window.history.pushState(null, "", "/async-fail");
      window.dispatchEvent(new Event("popstate"));

      await new Promise(process.nextTick);

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toBe("Chunk failed to load");
    });
  });
});
