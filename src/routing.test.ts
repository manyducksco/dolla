import assert from "node:assert";
import test from "node:test";

import { ParsedRoute, joinPath, matchRoutes, patternToFragments, resolvePath, sortRoutes } from "./routing.js";

test("add and match routes", (t) => {
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

  assert(match1);
  assert.equal(match1!.meta.testId, 1);
  assert.deepEqual(match1!.params, { named: "example" });

  assert(match2);
  assert.equal(match2!.meta.testId, 2);
  assert.deepEqual(match2!.params, { id: 123 });

  assert(match3);
  assert.equal(match3!.meta.testId, 3);
  assert.deepEqual(match3!.params, {});

  assert(match4);
  assert.equal(match4!.meta.testId, 4);
  assert.deepEqual(match4!.params, { id: 123, action: "edit" });
  // Numeric strings and boolean "true" and "false" strings are parsed into their JS type:
  assert.deepEqual(match4!.query, { example: 5, other_thing: "test", yes: true });

  assert(match5);
  assert.equal(match5!.meta.testId, 5);
  assert.deepEqual(match5!.params, {});

  assert(match6);
  assert.equal(match6!.meta.testId, 6);
  assert.deepEqual(match6!.params, { wildcard: "/some/other/stuff" });

  assert.equal(matchNone, undefined);
});

test("static joinPath: joins simple path fragments", (t) => {
  assert.equal(joinPath(["users", 5, "edit"]), "users/5/edit");
  assert.equal(joinPath(["/lots", "/of/", "/slashes/"]), "/lots/of/slashes");
  assert.equal(joinPath(["even/", "/more/", "slashes"]), "even/more/slashes");
});

test("static joinPath: resolves relative path segments", (t) => {
  assert.equal(joinPath(["users", 5, "edit", "../../12"]), "users/12");
  assert.equal(joinPath(["users", 15, "./edit"]), "users/15/edit");
});

test("static resolvePath: resolves relative paths", (t) => {
  assert.equal(resolvePath("/users/5", "."), "/users/5");
  assert.equal(resolvePath("/users/5/edit", ".."), "/users/5");
  assert.equal(resolvePath("/users/5/edit", "../../2/"), "/users/2");
  assert.equal(resolvePath("/users/5", "./edit"), "/users/5/edit");
  assert.equal(resolvePath("/users/5", "edit"), "/users/5/edit");
  assert.equal(resolvePath("/users/5/edit", "../delete"), "/users/5/delete");
});

test("static resolvePath: returns absolute paths", (t) => {
  assert.equal(resolvePath("/users/5", "/edit"), "/edit");
});
