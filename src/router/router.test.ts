import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContext, mountContext, type Context } from "../core/context.js";
import type { DollaPlugin } from "../core/index.js";
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

describe("Router Engine - Query strings", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  function createSearchRouter() {
    return createRouter({
      routes: [
        { path: "/", view: () => {} },
        { path: "/search", view: () => {} },
      ],
    });
  }

  it("keeps the query string when navigating with push", async () => {
    await withRouter(createSearchRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      store.push("/search?q=foo&sort=asc");
      await settle();

      expect(store.path()).toBe("/search");
      expect(store.query()).toEqual({ q: "foo", sort: "asc" });
      expect(window.location.pathname).toBe("/search");
      expect(window.location.search).toBe("?q=foo&sort=asc");
    });
  });

  it("keeps the query string when navigating with replace", async () => {
    await withRouter(createSearchRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      store.replace("/search?q=bar");
      await settle();

      expect(store.query()).toEqual({ q: "bar" });
      expect(window.location.search).toBe("?q=bar");
    });
  });

  it("keeps slashes inside query values", async () => {
    await withRouter(createSearchRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      store.push("/search?path=a/b");
      await settle();

      expect(store.path()).toBe("/search");
      expect(store.query()).toEqual({ path: "a/b" });
    });
  });

  it("keeps the query string on the initial page load", async () => {
    window.history.replaceState(null, "", "/search?q=initial");

    await withRouter(createSearchRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      expect(store.path()).toBe("/search");
      expect(store.query()).toEqual({ q: "initial" });
      expect(window.location.search).toBe("?q=initial");
    });
  });

  it("reads the query string on popstate (back/forward)", async () => {
    await withRouter(createSearchRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      window.history.pushState(null, "", "/search?q=history");
      window.dispatchEvent(new Event("popstate"));
      await settle();

      expect(store.query()).toEqual({ q: "history" });
      expect(window.location.search).toBe("?q=history");
    });
  });

  it("drops the previous query when navigating to a URL without one", async () => {
    await withRouter(createSearchRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      store.push("/search?q=foo");
      await settle();
      store.push("/");
      await settle();

      expect(store.query()).toEqual({});
      expect(window.location.search).toBe("");
    });
  });
});

describe("Router Engine - Error boundaries", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  const Layout = (props: any) => props.children;

  it("shows the errorView of the layer that failed", async () => {
    const router = createRouter({
      routes: [
        { path: "/", view: () => "home" },
        {
          path: "/app",
          view: Layout,
          routes: [
            {
              path: "/broken",
              view: () => "broken",
              preload: () => Promise.reject(new Error("boom")),
              errorView: (props) => `child error: ${props.error.message}`,
            },
          ],
        },
      ],
    });

    await withRouter(router, async (context) => {
      await settle();
      getRouter(context).push("/app/broken");
      await settle();

      expect(document.body.textContent).toBe("child error: boom");
    });
  });

  it("falls back to the nearest ancestor errorView", async () => {
    const router = createRouter({
      routes: [
        { path: "/", view: () => "home" },
        {
          path: "/app",
          view: Layout,
          errorView: (props) => `parent error: ${props.error.message}`,
          routes: [
            { path: "/ok", view: () => "ok" },
            { path: "/broken", view: () => "broken", preload: () => Promise.reject(new Error("boom")) },
          ],
        },
      ],
    });

    await withRouter(router, async (context) => {
      await settle();
      const store = getRouter(context);

      // Parent layer already mounted when the child fails
      store.push("/app/ok");
      await settle();
      expect(document.body.textContent).toBe("ok");

      store.push("/app/broken");
      await settle();
      expect(document.body.textContent).toBe("parent error: boom");

      // Recovers when navigating to a working sibling
      store.push("/app/ok");
      await settle();
      expect(document.body.textContent).toBe("ok");
    });
  });

  it("keeps the current view when no layer has an errorView", async () => {
    const router = createRouter({
      routes: [
        { path: "/", view: () => "home" },
        { path: "/broken", view: () => "broken", preload: () => Promise.reject(new Error("boom")) },
      ],
    });

    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);

    try {
      await withRouter(router, async (context) => {
        await settle();
        getRouter(context).push("/broken");
        await settle();

        expect(document.body.textContent).toBe("home");
        expect(getRouter(context).progress()).toBe(0);
      });
    } finally {
      process.off("unhandledRejection", onRejection);
    }

    expect(rejections).toHaveLength(1);
    expect((rejections[0] as Error).message).toBe("boom");
  });
});

describe("Router Engine - Query-only and hash-only hrefs", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    window.history.replaceState(null, "", "/list?a=1");
  });

  function createListRouter() {
    return createRouter({
      routes: [
        { path: "/", view: () => {} },
        { path: "/list", view: () => {} },
      ],
    });
  }

  it("keeps the current path for a query-only push and replaces the query", async () => {
    await withRouter(createListRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      store.push("?page=2");
      await settle();

      expect(window.location.pathname).toBe("/list");
      expect(window.location.search).toBe("?page=2");
      expect(store.path()).toBe("/list");
      expect(store.query()).toEqual({ page: "2" });
    });
  });

  it("keeps the current path and query for a hash-only push", async () => {
    await withRouter(createListRouter(), async (context) => {
      await settle();
      const store = getRouter(context);

      store.push("#top");
      await settle();

      expect(window.location.pathname).toBe("/list");
      expect(window.location.search).toBe("?a=1");
      expect(window.location.hash).toBe("#top");
      expect(store.path()).toBe("/list");
      expect(store.query()).toEqual({ a: "1" });
    });
  });

  it("leaves in-page anchor links to the browser", async () => {
    await withRouter(createListRouter(), async () => {
      await settle();

      const anchor = document.createElement("a");
      anchor.setAttribute("href", "#top");
      document.body.appendChild(anchor);

      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      anchor.dispatchEvent(event);
      anchor.remove();

      expect(event.defaultPrevented).toBe(false);
    });
  });
});

describe("Router Engine - Hash mode", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    window.history.replaceState(null, "", "/app/");
  });

  it("keeps the base path when navigating", async () => {
    const router = createRouter({
      hash: true,
      routes: [
        { path: "/", view: () => {} },
        { path: "/users", view: () => {} },
      ],
    });

    await withRouter(router, async (context) => {
      await settle();
      const store = getRouter(context);

      store.push("/users?tab=a");
      await settle();

      expect(window.location.pathname).toBe("/app/");
      expect(window.location.hash).toBe("#/users?tab=a");
      expect(store.path()).toBe("/users");
      expect(store.query()).toEqual({ tab: "a" });

      store.replace("/");
      await settle();

      expect(window.location.pathname).toBe("/app/");
      expect(window.location.hash).toBe("#/");
    });
  });
});
