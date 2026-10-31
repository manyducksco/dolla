import { describe, it, expect } from "vitest";
import { buildRouteTree, matchRoute } from "./utils.js"; // Adjust imports to your structure

describe("Radix Tree Routing Algorithm", () => {
  const dummyView = () => {};

  const routes = [
    { path: "/", view: dummyView },
    { path: "/users", view: dummyView },
    { path: "/users/:id", view: dummyView },
    { path: "/users/:id/settings", view: dummyView },
    { path: "/users/new", view: dummyView },
    { path: "/files/*", view: dummyView },
  ];

  const tree = buildRouteTree(routes);

  it("matches static routes exactly", () => {
    const match = matchRoute(tree, "/users");
    expect(match?.pattern).toBe("/users");
    expect(match?.params).toEqual({});
  });

  it("prioritizes static segments over parameters", () => {
    const match = matchRoute(tree, "/users/new");
    expect(match?.pattern).toBe("/users/new");
  });

  it("matches parameters as strings", () => {
    const numeric = matchRoute(tree, "/users/123");
    expect(numeric?.pattern).toBe("/users/:id");
    expect(numeric?.params.id).toBe("123");

    const text = matchRoute(tree, "/users/alice");
    expect(text?.pattern).toBe("/users/:id");
    expect(text?.params.id).toBe("alice");
  });

  it("decodes URL parameters", () => {
    const match = matchRoute(tree, "/users/john%20doe/settings");
    expect(match?.pattern).toBe("/users/:id/settings");
    expect(match?.params.id).toBe("john doe");
  });

  it("falls back to the raw segment for malformed percent-encoding", () => {
    expect(matchRoute(tree, "/users/100%")?.params).toEqual({ id: "100%" });
    expect(matchRoute(tree, "/files/a/100%")?.params).toEqual({ wildcard: "/a/100%" });
  });

  it("captures wildcards", () => {
    const match = matchRoute(tree, "/files/documents/2026/report.pdf");
    expect(match?.pattern).toBe("/files/*");
    expect(match?.params.wildcard).toBe("/documents/2026/report.pdf");
  });

  it("parses query strings", () => {
    const match = matchRoute(tree, "/users/123?tab=activity&sort=desc");
    expect(match?.query).toEqual({ tab: "activity", sort: "desc" });
  });

  it("returns undefined for misses", () => {
    const match = matchRoute(tree, "/unknown/path");
    expect(match).toBeUndefined();
  });
});

describe("Sibling param routes", () => {
  const dummyView = () => {};

  it("keeps each route's own param name", () => {
    const tree = buildRouteTree([
      { path: "/users/:id", view: dummyView },
      { path: "/users/:userId/posts", view: dummyView },
    ]);

    const user = matchRoute(tree, "/users/5");
    expect(user?.pattern).toBe("/users/:id");
    expect(user?.params).toEqual({ id: "5" });

    const posts = matchRoute(tree, "/users/5/posts");
    expect(posts?.pattern).toBe("/users/:userId/posts");
    expect(posts?.params).toEqual({ userId: "5" });
  });
});
