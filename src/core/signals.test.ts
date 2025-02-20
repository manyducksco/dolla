import { test, expect, vi } from "vitest";
import { get, peek, atom, compose, effect, isReactive, Reactive } from "./signals";

test("isReactive", () => {
  const a = atom(5);
  const c = compose(() => get(a) * 2);

  expect(isReactive(a)).toBe(true);
  expect(isReactive(c)).toBe(true);

  expect(isReactive("nope")).toBe(false);
});

test("get", () => {
  const a = atom(5);
  const c = compose(() => get(a) * 2);

  expect(get(a)).toBe(5);
  expect(get(c)).toBe(10);
  expect(get("yo")).toBe("yo");
});

test("basic composition & tracking", () => {
  const count = atom(5);
  const doubled = compose(() => get(count) * 2);

  expect(count.value).toBe(5);
  expect(doubled.value).toBe(10);

  const fn = vi.fn(() => {
    get(doubled);
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

  const multiplied = compose(() => get(a) * peek(b));

  expect(multiplied.value).toBe(50);

  a.value++;

  queueMicrotask(() => {
    expect(multiplied.value).toBe(60);

    b.value++;

    queueMicrotask(() => {
      expect(multiplied.value).toBe(60);
    });
  });
});

test("solves diamond problem", () => {
  const count = atom(1);

  const left = compose(() => get(count) + 5);
  const right = compose(() => get(count) / 2);

  const sum = compose(() => get(left) + get(right));

  const fn = vi.fn(() => {
    get(sum);
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
    return get(count);
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

test("nested compose", () => {
  const count = atom(0);

  const plus1 = (reactive: Reactive<number>) => compose(() => get(reactive) + 1);

  const one = plus1(count);
  const two = plus1(one);
  const three = plus1(two);

  const fn = vi.fn(() => {
    get(three);
  });
  const stop = effect(fn);

  queueMicrotask(() => {
    expect(fn).toBeCalledTimes(1);

    expect(one.value).toBe(1);
    expect(two.value).toBe(2);
    expect(three.value).toBe(3);

    count.value++;

    queueMicrotask(() => {
      expect(fn).toBeCalledTimes(2);

      expect(one.value).toBe(2);
      expect(two.value).toBe(3);
      expect(three.value).toBe(4);

      stop();
    });
  });
});
