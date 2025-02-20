import { describe, test, expect } from "vitest";
import { typeOf, isFunction } from "./typeChecking";

describe("typeOf", () => {
  test("identifies types", () => {
    expect(typeOf([])).toBe("array");
    expect(typeOf({})).toBe("object");
    expect(typeOf(new Map())).toBe("map");
    expect(typeOf(new Set())).toBe("set");
    expect(typeOf(true)).toBe("boolean");
    expect(typeOf(false)).toBe("boolean");
    expect(typeOf(class Test {})).toBe("class");
  });
});

describe("isFunction", () => {
  test("identifies a function", () => {
    expect(isFunction(function () {})).toBe(true);
    expect(isFunction((...args: any[]) => true)).toBe(true);
    expect(isFunction(class Test {})).toBe(false);
  });
});
