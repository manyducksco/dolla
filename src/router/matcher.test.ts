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

  it("decodes URL parameters", () => {
    const match = matchRoute(tree, "/users/john%20doe/settings");
    expect(match?.pattern).toBe("/users/:id/settings");
    expect(match?.params.id).toBe("john doe");
  });

  it("falls back to the raw segment for malformed percent-encoding", () => {
    expect(matchRoute(tree, "/users/100%")?.params).toEqual({ id: "100%" });
    expect(matchRoute(tree, "/files/a/100%")?.params).toEqual({ wildcard: "/a/100%" });
  });

  it("keeps '?' inside query values", () => {
    const match = matchRoute(tree, "/users/123?next=/a?b=1");
    expect(match?.params.id).toBe("123");
    expect(match?.query).toEqual({ next: "/a?b=1" });
  });

  it("ignores a #fragment when matching", () => {
    expect(matchRoute(tree, "/users/123#top")?.params).toEqual({ id: "123" });
    expect(matchRoute(tree, "/users#top")?.pattern).toBe("/users");

    const withQuery = matchRoute(tree, "/users/123?tab=a#top");
    expect(withQuery?.params).toEqual({ id: "123" });
    expect(withQuery?.query).toEqual({ tab: "a" });
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
