import { expect, test, vi } from "vitest";
import { batch, effect, get, Signal, memo, writable, untracked } from "./signals";

test("basic composition & tracking", () => {
  const count = writable(5);
  const doubled = () => count() * 2;
  const doubledMemo = memo(() => count() * 2);

  const same = memo(count); // just so happens to follow the signature of a memo; creates a Signal with the same value
  expect(same()).toBe(5);

  expect(count()).toBe(5);
  expect(get(doubled)).toBe(10);
  expect(doubledMemo()).toBe(10);

  const fn = vi.fn(() => {
    doubled();
  });
  const stop = effect(fn);

  expect(fn).toBeCalledTimes(1);

  // Effects should not run until end of batch.
  batch(() => {
    count.set((c) => c + 1);
    count.set((c) => c + 1);
    count.set((c) => c + 1);
    count.set((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);
  expect(same()).toBe(9);

  stop();
});

test("signals returned from memo function are unwrapped", () => {
  const count = writable(5);
  const doubled = memo(() => count);

  expect(doubled()).toBe(5);

  count.set((x) => x + 1);

  expect(doubled()).toBe(6);
});

test("untracked callback is not tracked", () => {
  const a = writable(5);
  const b = writable(10);

  const multiplied = memo(() => a() * untracked(b));

  expect(multiplied()).toBe(50);

  a.set((x) => x + 1);

  expect(multiplied()).toBe(60);

  b.set((x) => x + 1);

  expect(multiplied()).toBe(60);
});

test("solves diamond problem", () => {
  const count = writable(1);

  const left = memo(() => count() + 5);
  const right = memo(() => count() / 2);

  const sum = memo(() => left() + right());

  const fn = vi.fn(() => {
    sum();
  });
  const unsubscribe = effect(fn);

  expect(fn).toBeCalledTimes(1);

  count.set((x) => x + 1);
  batch(() => {
    count.set((x) => x + 1);
    count.set((x) => x + 1);
  });

  expect(fn).toBeCalledTimes(3);
  unsubscribe();
});

test("nested memo", () => {
  const count = writable(0);

  const plus1 = (source: Signal<number>) => {
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

  count.set((x) => x + 1);

  expect(fn).toBeCalledTimes(2);

  expect(one()).toBe(2);
  expect(two()).toBe(3);
  expect(three()).toBe(4);

  stop();
});

test("effect runs cleanup function", () => {
  const fn = vi.fn();
  const count = writable(0);

  const stop = effect(() => {
    count();
    return fn;
  });
  expect(fn).toBeCalledTimes(0);

  count.set(2);
  expect(fn).toBeCalledTimes(1);

  count.set(3);
  expect(fn).toBeCalledTimes(2);

  stop();
});
