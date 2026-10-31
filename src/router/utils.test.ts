import { describe, test, expect, vi } from "vitest";
import { buildRouteTree, catchLinks, createHistoryAdapter, joinPath, matchRoute, resolvePath, resolveRoute } from "./utils.js";
import type { Route } from "./types.js";

test("add and match routes", () => {
  let routes: Route[] = [];

  routes.push({
    path: "/:named",
    meta: { testId: 1 },
    view: () => "test",
  });
  routes.push({
    path: "/users/:id",
    meta: { testId: 2 },
    view: () => "test",
  });
  routes.push({
    path: "/users/me",
    meta: { testId: 3 },
    view: () => "test",
  });
  routes.push({
    path: "/users/:id/:action",
    meta: { testId: 4 },
    view: () => "test",
  });
  routes.push({
    path: "/users/2/edit",
    meta: { testId: 5 },
    view: () => "test",
  });
  routes.push({
    path: "/wild/*",
    meta: { testId: 6 },
    view: () => "test",
  });
  const routeTree = buildRouteTree(routes);

  const match1 = matchRoute(routeTree, "/example");
  const match2 = matchRoute(routeTree, "/users/123");
  const match3 = matchRoute(routeTree, "/users/me");
  const match4 = matchRoute(
    routeTree,
    // Query params should be parsed but won't affect path matching.
    "/users/123/edit?example=5&other_thing=test&yes=true",
  );
  const match5 = matchRoute(routeTree, "/users/2/edit");
  const match6 = matchRoute(routeTree, "/wild/some/other/stuff");
  const matchNone = matchRoute(routeTree, "/no/matches/too/many/segments");

  expect(match1).toBeTruthy();
  expect(match1!.meta.testId).toBe(1);
  expect(match1!.params).toStrictEqual({ named: "example" });

  expect(match2).toBeTruthy();
  expect(match2!.meta.testId).toBe(2);
  expect(match2!.params).toStrictEqual({ id: "123" });

  expect(match3).toBeTruthy();
  expect(match3!.meta.testId).toBe(3);
  expect(match3!.params).toStrictEqual({});

  expect(match4).toBeTruthy();
  expect(match4!.meta.testId).toBe(4);
  expect(match4!.params).toStrictEqual({ id: "123", action: "edit" });
  expect(match4!.query).toStrictEqual({ example: "5", other_thing: "test", yes: "true" });

  expect(match5).toBeTruthy();
  expect(match5!.meta.testId).toBe(5);
  expect(match5!.params).toStrictEqual({});

  expect(match6).toBeTruthy();
  expect(match6!.meta.testId).toStrictEqual(6);
  expect(match6!.params).toStrictEqual({ wildcard: "/some/other/stuff" });

  expect(matchNone).toBeUndefined();
});

test("rejects legacy brace route params", () => {
  expect(() =>
    buildRouteTree([{ path: "/users/{id}", view: () => "test" }]),
  ).toThrow('Route params use ":name" syntax');
  expect(() =>
    buildRouteTree([{ path: "/users/{#id}", view: () => "test" }]),
  ).toThrow('Route params use ":name" syntax');
  expect(() =>
    buildRouteTree([{ path: "/users/{id?}", view: () => "test" }]),
  ).toThrow('Route params use ":name" syntax');
});

test("rejects invalid route params", () => {
  expect(() =>
    buildRouteTree([{ path: "/users/:id.json", view: () => "test" }]),
  ).toThrow("Invalid route param");
});

test("rejects duplicate route patterns", () => {
  const view = () => "test";
  expect(() =>
    buildRouteTree([
      { path: "/users", view },
      { path: "/users", view },
    ]),
  ).toThrow("Duplicate route: /users");
  expect(() =>
    buildRouteTree([
      { path: "/users/:id", view },
      { path: "/users/:userId", view },
    ]),
  ).toThrow("Duplicate route: /users/:userId");
  expect(() =>
    buildRouteTree([
      { path: "/users", view, routes: [{ path: "/:id", view }] },
      { path: "/users/:id", view },
    ]),
  ).toThrow("Duplicate route: /users/:id");
});

test("rejects segments after a wildcard", () => {
  expect(() => buildRouteTree([{ path: "/files/*/edit", view: () => "test" }])).toThrow(
    "Wildcard must be the last segment: /files/*/edit",
  );
});

test("static joinPath: joins simple path fragments", () => {
  expect(joinPath(["users", 5, "edit"])).toBe("users/5/edit");
  expect(joinPath(["/lots", "/of/", "/slashes/"])).toBe("/lots/of/slashes");
  expect(joinPath(["even/", "/more/", "slashes"])).toBe("even/more/slashes");
});

test("static joinPath: resolves relative path segments", () => {
  expect(joinPath(["users", 5, "edit", "../../12"])).toBe("users/12");
  expect(joinPath(["users", 15, "./edit"])).toBe("users/15/edit");
});

test("static resolvePath: resolves relative paths", () => {
  expect(resolvePath("/users/5", ".")).toBe("/users/5");
  expect(resolvePath("/users/5/edit", "..")).toBe("/users/5");
  expect(resolvePath("/users/5/edit", "../../2/")).toBe("/users/2");
  expect(resolvePath("/users/5", "./edit")).toBe("/users/5/edit");
  expect(resolvePath("/users/5", "edit")).toBe("/users/5/edit");
  expect(resolvePath("/users/5/edit", "../delete")).toBe("/users/5/delete");
});

test("resolveRoute: reports redirect loops with a clear error", async () => {
  const tree = buildRouteTree([
    { path: "/a", redirect: "/b" },
    { path: "/b", redirect: "/a" },
  ]);
  await expect(resolveRoute(tree, "/a")).rejects.toThrow("Redirect loop: /a -> /b -> /a");
});

test("resolveRoute: reports endless dynamic redirects", async () => {
  let n = 0;
  const tree = buildRouteTree([
    { path: "/n/:id", redirect: () => `/n/${++n}` },
  ]);
  await expect(resolveRoute(tree, "/n/0")).rejects.toThrow("Redirect loop");
});

test("resolveRoute: re-encodes params inserted into redirect targets", async () => {
  const tree = buildRouteTree([
    { path: "/old/:id", redirect: "/new/:id" },
    { path: "/new/:id", view: () => "test" },
  ]);
  const { match } = await resolveRoute(tree, "/old/a%2Fb%20c");
  expect(match?.path).toBe("/new/a%2Fb%20c");
  expect(match?.params).toEqual({ id: "a/b c" });
});

test("merges meta from all ancestor layers", () => {
  const view = () => "test";
  const tree = buildRouteTree([
    {
      path: "/a",
      view,
      meta: { a: 1, shared: "a" },
      routes: [
        {
          path: "/b",
          view,
          meta: { b: 2, shared: "b" },
          routes: [
            { path: "/c", view, meta: { c: 3 } },
            { path: "/none", view },
          ],
        },
      ],
    },
  ]);

  expect(matchRoute(tree, "/a/b/c")?.meta).toEqual({ a: 1, b: 2, c: 3, shared: "b" });
  expect(matchRoute(tree, "/a/b/none")?.meta).toEqual({ a: 1, b: 2, shared: "b" });
});

test("static resolvePath: returns absolute paths", () => {
  expect(resolvePath("/users/5", "/edit")).toBe("/edit");
});

describe("createHistoryAdapter", () => {
  test("hash mode splits a fragment inside the hash from the path and query", () => {
    window.history.replaceState(null, "", "/app/#/users?tab=a#top");
    const history = createHistoryAdapter(true);
    expect(history.getPath()).toBe("/users");
    expect(history.getSearch()).toBe("?tab=a");
    expect(history.getFragment()).toBe("#top");

    window.history.replaceState(null, "", "/app/#/users#top");
    expect(history.getPath()).toBe("/users");
    expect(history.getSearch()).toBe("");

    window.history.replaceState(null, "", "/");
  });
});

describe("catchLinks", () => {
  function click(root: Element, href: string, init: MouseEventInit = {}) {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    root.appendChild(anchor);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...init });
    anchor.dispatchEvent(event);
    anchor.remove();
    return event.defaultPrevented;
  }

  test("intercepts plain same-origin links and leaves the rest to the browser", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const callback = vi.fn();
    const stop = catchLinks(root, callback);

    expect(click(root, "/users")).toBe(true);
    expect(callback).toHaveBeenCalledWith("/users");

    expect(click(root, "https://example.com/x")).toBe(false);
    expect(click(root, "mailto:a@example.com")).toBe(false);
    expect(click(root, "#top")).toBe(false);
    expect(click(root, "/users", { button: 1 })).toBe(false);
    expect(click(root, "/users", { metaKey: true })).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);

    stop();
    expect(click(root, "/users")).toBe(false);
    root.remove();
  });
});
