import { describe, expect, test, vi } from "vitest";
import { batch, effect, getter, type Getter, memo, peek, state, subscribe } from "./reactive";

test("basic composition & tracking", () => {
  const [count, setCount] = state(5);
  const doubled = memo(() => count() * 2);

  const same = getter(count);
  expect(same()).toBe(5);

  expect(count()).toBe(5);
  expect(peek(doubled)).toBe(10);
  expect(doubled()).toBe(10);

  const fn = vi.fn(() => {
    doubled();
  });
  const stop = effect(fn);

  expect(fn).toBeCalledTimes(1);

  // Effects should not run until end of batch.
  batch(() => {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);
  expect(peek(same)).toBe(9);

  stop();
});

test("values are not tracked when accessed with peek()", () => {
  const [a, setA] = state(5);
  const [b, setB] = state(10);

  const multiplied = memo(() => a() * peek(b));

  expect(multiplied()).toBe(50);

  setA((x) => x + 1);

  expect(multiplied()).toBe(60);

  setB((x) => x + 1);

  expect(multiplied()).toBe(60);
});

test("solves diamond problem", () => {
  const [count, setCount] = state(1);

  const left = memo(() => count() + 5);
  const right = memo(() => count() / 2);

  const sum = memo(() => left() + right());

  const fn = vi.fn(() => {
    sum();
  });
  const unsubscribe = effect(fn);

  expect(fn).toBeCalledTimes(1);

  setCount((x) => x + 1);
  batch(() => {
    setCount((x) => x + 1);
    setCount((x) => x + 1);
  });

  expect(fn).toBeCalledTimes(3);
  unsubscribe();
});

test("nested memo", () => {
  const [count, setCount] = state(0);

  const plus1 = (source: Getter<number>) => {
    return memo(() => source() + 1);
  };

  const one = plus1(count);
  const two = plus1(one);
  const three = plus1(two);

  const fn = vi.fn(() => {
    three();
  });
  const stop = effect(fn);

  expect(fn).toBeCalledTimes(1);

  expect(one()).toBe(1);
  expect(two()).toBe(2);
  expect(three()).toBe(3);

  setCount((x) => x + 1);

  expect(fn).toBeCalledTimes(2);

  expect(one()).toBe(2);
  expect(two()).toBe(3);
  expect(three()).toBe(4);

  stop();
});

test("effect runs cleanup function", () => {
  const fn = vi.fn();
  const [count, setCount] = state(0);

  const stop = effect(() => {
    count();
    return fn;
  });
  expect(fn).toBeCalledTimes(0);

  setCount(2);
  expect(fn).toBeCalledTimes(1);

  setCount(3);
  expect(fn).toBeCalledTimes(2);

  stop();
});

describe("subscribe", () => {
  //   test("immediately cancelling doesn't crash", () => {
  //     const fn = vi.fn();
  //     const count = state(5);

  //     expect(() => {
  //       const cancel = subscribe(count, (value) => {
  //         fn(value);
  //         cancel();
  //       });
  //     }).not.toThrowError();

  //     expect(fn).toHaveBeenCalledTimes(1);

  //     count.update((current) => current + 1);

  //     expect(fn).toHaveBeenCalledTimes(1);
  //   });

  test("ignores tracked values in callback", () => {
    const [count, setCount] = state(5);
    const [other, setOther] = state("hi");

    const fn = vi.fn();

    const unsub = subscribe(count, (value) => {
      other(); // trackable getter
      fn();
      return value * 2;
    });

    expect(fn).toBeCalledTimes(1);

    setCount(12);

    expect(fn).toBeCalledTimes(2); // tracked `count` has updated

    setOther("hello");

    expect(fn).toBeCalledTimes(2); // `other` is not tracked

    unsub();
  });
});
