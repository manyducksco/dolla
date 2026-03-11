import { describe, test, expect } from "vitest";
import { isFunction } from "./utils";

describe("type checking", () => {
  describe("isFunction", () => {
    test("identifies a function", () => {
      expect(isFunction(function () {})).toBe(true);
      expect(isFunction((...args: any[]) => true)).toBe(true);
      expect(isFunction(class Test {})).toBe(false);
    });
  });
});
