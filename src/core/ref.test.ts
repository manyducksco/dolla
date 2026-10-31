import { describe, expect, test } from "vitest";
import { createRef } from "./ref.js";

describe("createRef", () => {
  test("reading without setting returns undefined", () => {
    const ref = createRef<number>();
    expect(ref()).toBeUndefined();
  });

  test("setting updates the value", () => {
    const ref = createRef<string>();
    ref("hello");
    expect(ref()).toBe("hello");
    ref("world");
    expect(ref()).toBe("world");
  });

  test("cleanup function clears the value", () => {
    const ref = createRef<number>();
    const cleanup = ref(42);
    expect(ref()).toBe(42);
    cleanup();
    expect(ref()).toBeUndefined();
  });

  test("a stale cleanup does not clear a newer value", () => {
    const ref = createRef<string>();
    const cleanupA = ref("a");
    ref("b");
    cleanupA();
    expect(ref()).toBe("b");
  });

  test("multiple refs are independent", () => {
    const refA = createRef<number>();
    const refB = createRef<number>();
    refA(1);
    refB(2);
    expect(refA()).toBe(1);
    expect(refB()).toBe(2);
  });
});
