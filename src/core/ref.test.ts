import { test, expect } from "vitest";
import { ref } from "./ref";

test("stores and returns a value", () => {
  const value = ref(10);
  expect(value()).toBe(10);

  value(50);
  expect(value()).toBe(50);
});

test("throws error when getting empty value", () => {
  const empty = ref<string>();
  const notEmpty = ref(undefined);
  const alsoNotEmpty = ref(null);

  expect(() => empty()).toThrowError();
  expect(() => notEmpty()).not.toThrowError();
  expect(() => alsoNotEmpty()).not.toThrowError();
});
