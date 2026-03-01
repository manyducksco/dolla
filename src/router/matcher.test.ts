import { describe, it, expect } from "vitest";
import { buildRouteTree, matchRoute } from "./utils.js"; // Adjust imports to your structure

describe("Radix Tree Routing Algorithm", () => {
  const dummyView = () => {};

  const routes = [
    { path: "/", view: dummyView },
    { path: "/users", view: dummyView },
    { path: "/users/{id}", view: dummyView },
    { path: "/users/{id}/settings", view: dummyView },
    { path: "/users/{#id}", view: dummyView },
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

  it("enforces numeric parameters", () => {
    const match = matchRoute(tree, "/users/123");
    expect(match?.pattern).toBe("/users/{#id}");
    expect(match?.params.id).toBe("123");
  });

  it("falls back to string parameters if numeric fails", () => {
    const match = matchRoute(tree, "/users/alice");
    expect(match?.pattern).toBe("/users/{id}");
    expect(match?.params.id).toBe("alice");
  });

  it("decodes URL parameters", () => {
    const match = matchRoute(tree, "/users/john%20doe/settings");
    expect(match?.pattern).toBe("/users/{id}/settings");
    expect(match?.params.id).toBe("john doe");
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
