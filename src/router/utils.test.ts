import { test, expect } from "vitest";
import { buildRouteTree, joinPath, matchRoute, resolvePath } from "./utils.js";
import type { Route } from "./types.js";

test("add and match routes", () => {
  let routes: Route[] = [];

  routes.push({
    path: "/{named}",
    meta: { testId: 1 },
    view: () => "test",
  });
  routes.push({
    path: "/users/{#id}",
    meta: { testId: 2 },
    view: () => "test",
  });
  routes.push({
    path: "/users/me",
    meta: { testId: 3 },
    view: () => "test",
  });
  routes.push({
    path: "/users/{#id}/{action}",
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
  routes.push({
    path: "/optional/{one?}",
    meta: { testId: 7 },
    view: () => "test",
  });
  routes.push({
    path: "/optional2/{#optNumber?}/{required}",
    meta: { testId: 8 },
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
  const match7_1 = matchRoute(routeTree, "/optional");
  const match7_2 = matchRoute(routeTree, "/optional/additional");
  const match8_1 = matchRoute(routeTree, "/optional2/5/present");
  const match8_2 = matchRoute(routeTree, "/optional2/present");
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

  expect(match7_1).toBeTruthy();
  expect(match7_1!.meta.testId).toStrictEqual(7);
  expect(match7_1!.params).toStrictEqual({});
  expect(match7_2).toBeTruthy();
  expect(match7_2!.meta.testId).toStrictEqual(7);
  expect(match7_2!.params).toStrictEqual({ one: "additional" });

  expect(match8_1).toBeTruthy();
  expect(match8_1!.meta.testId).toStrictEqual(8);
  expect(match8_1!.params).toStrictEqual({ optNumber: "5", required: "present" });
  expect(match8_2).toBeTruthy();
  expect(match8_2!.meta.testId).toStrictEqual(8);
  expect(match8_2!.params).toStrictEqual({ required: "present" });

  expect(matchNone).toBeUndefined();
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

test("static resolvePath: returns absolute paths", () => {
  expect(resolvePath("/users/5", "/edit")).toBe("/edit");
});
