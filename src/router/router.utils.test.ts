import { test, expect } from "vitest";

import { type ParsedRoute, joinPath, matchRoutes, patternToFragments, resolvePath, sortRoutes } from "./router.utils";

test("add and match routes", () => {
  let routes: ParsedRoute<{ testId: number }>[] = [];

  routes.push({
    pattern: "/{named}",
    meta: { testId: 1 },
    fragments: patternToFragments("/{named}"),
  });
  routes.push({
    pattern: "/users/{#id}",
    meta: { testId: 2 },
    fragments: patternToFragments("/users/{#id}"),
  });
  routes.push({
    pattern: "/users/me",
    meta: { testId: 3 },
    fragments: patternToFragments("/users/me"),
  });
  routes.push({
    pattern: "/users/{#id}/{action}",
    meta: { testId: 4 },
    fragments: patternToFragments("/users/{#id}/{action}"),
  });
  routes.push({
    pattern: "/users/2/edit",
    meta: { testId: 5 },
    fragments: patternToFragments("/users/2/edit"),
  });
  routes.push({
    pattern: "/wild/*",
    meta: { testId: 6 },
    fragments: patternToFragments("/wild/*"),
  });

  routes = sortRoutes(routes);

  const match1 = matchRoutes(routes, "/example");
  const match2 = matchRoutes(routes, "/users/123");
  const match3 = matchRoutes(routes, "/users/me");
  const match4 = matchRoutes(
    routes,
    // Query params should be parsed but won't affect path matching.
    "/users/123/edit?example=5&other_thing=test&yes=true",
  );
  const match5 = matchRoutes(routes, "/users/2/edit");
  const match6 = matchRoutes(routes, "/wild/some/other/stuff");
  const matchNone = matchRoutes(routes, "/no/matches/too/many/segments");

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
