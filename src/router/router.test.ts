import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context } from "../core/context.js";
import { View } from "../types.js";
import { createRouter, lazy, RedirectError } from "./router.js";
import { RouterStore } from "./store.js";
import { ViewNode } from "../core/markup/nodes/view.js";
import { PARENT_ELEMENT } from "../core/symbols.js";

async function withMountedView<Props>(view: View<Props>, props: Props, callback: (context: Context) => any) {
  const context = new Context("test");
  context.state[PARENT_ELEMENT] = document.body;

  const node = new ViewNode(context, view, props);

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

    const routerView = createRouter({
      routes: [
        {
          path: "/",
          view: RootView,
          meta: { requiresAuth: false },
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

    await withMountedView(routerView, {}, async (context) => {
      // Push new route and wait for microtasks (updateRoute execution)
      window.history.pushState(null, "", "/dashboard");
      window.dispatchEvent(new Event("popstate"));
      await Promise.resolve();

      const store = context.getStore(RouterStore);

      expect(store.path.get()).toBe("/dashboard");
      expect(store.meta.get()).toEqual({ requiresAuth: true, title: "Dashboard" });
    });
  });

  it("executes preload functions and maps data to views", async () => {
    const preloadSpy = vi.fn().mockResolvedValue({ user: "Alice" });
    let capturedProps: any;

    const routerView = createRouter({
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

    await withMountedView(routerView, {}, async (context) => {
      window.history.pushState(null, "", "/profile");
      window.dispatchEvent(new Event("popstate"));

      // Allow promises to flush
      await new Promise(process.nextTick);

      expect(preloadSpy).toHaveBeenCalled();
      expect(capturedProps.data).toEqual({ user: "Alice" });
    });
  });

  it("handles RedirectError gracefully", async () => {
    const routerView = createRouter({
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

    await withMountedView(routerView, {}, async (context) => {
      window.history.pushState(null, "", "/protected");
      window.dispatchEvent(new Event("popstate"));
      await new Promise(process.nextTick);

      const store = context.getStore(RouterStore);
      expect(store.path.get()).toBe("/login");
    });
  });

  it("blocks navigation if guard returns false", async () => {
    const routerView = createRouter({
      routes: [
        { path: "/", view: () => {} },
        { path: "/form", view: () => {} },
      ],
    });

    await withMountedView(routerView, {}, async (context) => {
      const store = context.getStore(RouterStore);

      store.push("/form");
      await new Promise(process.nextTick);

      // Add a blocker
      const unblock = store.block(() => false);

      // Attempt to navigate away
      store.push("/");
      await new Promise(process.nextTick);

      // Navigation should have failed
      expect(store.path.get()).toBe("/form");

      // Remove blocker and try again
      unblock();
      store.push("/");
      await new Promise(process.nextTick);

      expect(store.path.get()).toBe("/");
    });
  });

  it("updates query parameters reactively without unmounting", async () => {
    const routerView = createRouter({
      routes: [{ path: "/search", view: () => {} }],
    });

    await withMountedView(routerView, {}, async (context) => {
      window.history.pushState(null, "", "/search");
      window.dispatchEvent(new Event("popstate"));
      await new Promise(process.nextTick);

      const store = context.getStore(RouterStore);

      store.updateQuery({ q: "potato", sort: "asc" });

      expect(store.query.get()).toEqual({ q: "potato", sort: "asc" });
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

    const routerView = createRouter({
      routes: [{ path: "/async", view: lazy(loaderSpy) }],
    });

    await withMountedView(routerView, {}, async (context) => {
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

    const routerView = createRouter({
      routes: [{ path: "/", view: () => {} }, lazyRoute],
    });

    await withMountedView(routerView, {}, async (context) => {
      // First visit: triggers network request
      window.history.pushState(null, "", "/async");
      window.dispatchEvent(new Event("popstate"));
      await new Promise(process.nextTick);

      expect(loaderSpy).toHaveBeenCalledTimes(1);

      // The router should have mutated the route layer to hold the actual view
      expect(lazyRoute.view).toBe(MockView);

      // Navigate away
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new Event("popstate"));
      await new Promise(process.nextTick);

      // Second visit: should use cached view, no network request
      window.history.pushState(null, "", "/async");
      window.dispatchEvent(new Event("popstate"));
      await new Promise(process.nextTick);

      // Loader should still only have been called once
      expect(loaderSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("catches lazy load failures and triggers errorView", async () => {
    const loaderSpy = vi.fn().mockRejectedValue(new Error("Chunk failed to load"));
    let capturedError: Error | undefined;

    const routerView = createRouter({
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

    await withMountedView(routerView, {}, async (context) => {
      window.history.pushState(null, "", "/async-fail");
      window.dispatchEvent(new Event("popstate"));

      await new Promise(process.nextTick);

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toBe("Chunk failed to load");
    });
  });
});
