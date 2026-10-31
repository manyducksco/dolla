import { describe, test, expect } from "vitest";
import { isFunction } from "./utils";

describe("type checking", () => {
  describe("isFunction", () => {
    test("identifies a function", () => {
      expect(isFunction(function () {})).toBe(true);
      expect(isFunction((...args: any[]) => true)).toBe(true);
      expect(isFunction(class Test {})).toBe(false);
    });

    test("distinguishes classes from functions of every kind, repeatedly", () => {
      class Base {}
      class Derived extends Base {}
      const values: [unknown, boolean][] = [
        [function named() {}, true],
        [() => 1, true],
        [async () => 1, true],
        [function* gen() {}, true],
        [function () {}.bind(null), true],
        [{ method() {} }.method, true],
        [Date, true],
        [Base, false],
        [Derived, false],
        [class {}, false],
      ];
      // Twice, so any caching gives the same answer as the first check.
      for (let i = 0; i < 2; i++) {
        for (const [value, expected] of values) {
          expect(isFunction(value)).toBe(expected);
        }
      }
    });
  });
});
