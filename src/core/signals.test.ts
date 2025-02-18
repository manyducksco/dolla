import { test, expect, vi } from "vitest";
import { get, peek, atom, compose, effect, isReactive } from "./signals";

test("isReactive", () => {
  const a = atom(5);
  const c = compose(() => a.value * 2);

  expect(isReactive(a)).toBe(true);
  expect(isReactive(c)).toBe(true);

  expect(isReactive("nope")).toBe(false);
});

test("get", () => {
  const a = atom(5);
  const c = compose(() => a.value * 2);

  expect(get(a)).toBe(5);
  expect(get(c)).toBe(10);
  expect(get("yo")).toBe("yo");
});

test("basic composition & tracking", () => {
  const count = atom(5);
  const doubled = compose(() => count.value * 2);

  expect(count.value).toBe(5);
  expect(doubled.value).toBe(10);

  const fn = vi.fn(() => {
    doubled.value;
  });
  const stop = effect(fn);

  // Effects are batched in a microtask.
  queueMicrotask(() => {
    expect(fn).toBeCalledTimes(1);

    count.value++;
    count.value++;

    queueMicrotask(() => {
      count.value++;
      count.value++;

      expect(fn).toBeCalledTimes(2);
    });

    stop();
  });
});

test("compose: returning reactives", () => {
  const count = atom(5);
  const doubled = compose(() => count);

  expect(doubled.value).toBe(5);

  count.value++;

  expect(doubled.value).toBe(6);
});

test("peek: prevents tracking", () => {
  const a = atom(5);
  const b = atom(10);

  const multiplied = compose(() => a.value * peek(b));

  expect(multiplied.value).toBe(50);

  const batched = compose(() => {
    const A = a.value;
    const B = peek(() => a.value + b.value);
    return [A, B];
  });

  a.value++;

  queueMicrotask(() => {
    expect(multiplied.value).toBe(60);
    expect(batched.value).toStrictEqual([6, 16]);

    b.value++;

    queueMicrotask(() => {
      expect(multiplied.value).toBe(60);
      expect(batched.value).toStrictEqual([6, 16]);
    });
  });
});

test("solves diamond problem", () => {
  const count = atom(1);

  const left = compose(() => count.value + 5);
  const right = compose(() => count.value / 2);

  const sum = compose(() => left.value + right.value);

  const fn = vi.fn(() => {
    sum.value;
  });
  const unsubscribe = effect(fn);

  queueMicrotask(() => {
    expect(fn).toBeCalledTimes(1);

    count.value++;
    count.value++;
    count.value++;

    // Subscribers are not called until next microtask phase.
    queueMicrotask(() => {
      expect(fn).toBeCalledTimes(2);
      unsubscribe();
    });
  });
});

test("compose receives previous value", () => {
  const count = atom(0);

  const fn = vi.fn();
  const composed = compose((previous) => {
    fn(previous);
    return count.value;
  });

  composed.value;

  expect(fn).toBeCalledTimes(1);
  expect(fn).toBeCalledWith(undefined);

  count.value++;
  composed.value;

  expect(fn).toBeCalledTimes(2);
  expect(fn).toBeCalledWith(0);

  count.value++;
  composed.value;

  expect(fn).toBeCalledTimes(3);
  expect(fn).toBeCalledWith(1);
});
