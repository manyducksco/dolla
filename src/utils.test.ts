import { describe, test, expect } from "vitest";
import { isFunction } from "./utils";

describe("type checking", () => {
  describe("isFunction", () => {
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
        [String, true],
        [Object.assign(function withStatics() {}, { extra: 1 }), true],
        [Object.defineProperty(function frozenPrototype() {}, "prototype", { writable: false }), true],
        [Object.setPrototypeOf(() => 1, { prototype: {} }), true],
        [new Proxy(function proxied() {}, {}), true],
        [undefined, false],
        [null, false],
        [{}, false],
        ["function", false],
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
