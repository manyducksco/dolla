import { expect, test, vi } from "vitest";
import { batch, effect, get, type Getter, compose, peek, atom } from "./signal";

test("basic composition & tracking", () => {
  const [count, setCount] = atom(5);
  const doubled = () => count() * 2;
  const doubledMemo = compose(() => count() * 2);

  const same = compose(count); // just so happens to follow the signature of a memo; creates a Signal with the same value
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
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);
  expect(same()).toBe(9);

  stop();
});

test("getters returned from computed function are unwrapped", () => {
  const [count, setCount] = atom(5);
  const doubled = compose(() => count);

  expect(doubled()).toBe(5);

  setCount((x) => x + 1);

  expect(doubled()).toBe(6);
});

test("untracked callback is not tracked", () => {
  const [a, setA] = atom(5);
  const [b, setB] = atom(10);

  const multiplied = compose(() => a() * peek(b));

  expect(multiplied()).toBe(50);

  setA((x) => x + 1);

  expect(multiplied()).toBe(60);

  setB((x) => x + 1);

  expect(multiplied()).toBe(60);
});

test("solves diamond problem", () => {
  const [count, setCount] = atom(1);

  const left = compose(() => count() + 5);
  const right = compose(() => count() / 2);

  const sum = compose(() => left() + right());

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
  const [count, setCount] = atom(0);

  const plus1 = (source: Getter<number>) => {
    return compose(() => source() + 1);
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
  const [count, setCount] = atom(0);

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
