import { expect, test, vi } from "vitest";
import { batch, computed, watch, read, Readable, state, toReadable } from "./signal";

test("basic composition & tracking", () => {
  const count = state(5);
  const doubled = computed(() => count.track() * 2);

  const same = toReadable(count); // just so happens to follow the signature of a memo; creates a Signal with the same value
  expect(same.read()).toBe(5);

  expect(count.read()).toBe(5);
  expect(read(doubled)).toBe(10);
  expect(doubled.read()).toBe(10);

  const fn = vi.fn(() => {
    doubled.track();
  });
  const stop = watch(fn);

  expect(fn).toBeCalledTimes(1);

  // Effects should not run until end of batch.
  batch(() => {
    count.update((c) => c + 1);
    count.update((c) => c + 1);
    count.update((c) => c + 1);
    count.update((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);
  expect(same.read()).toBe(9);

  stop();
});

test("readables returned from computed function are unwrapped", () => {
  const count = state(5);
  const doubled = computed(() => count);

  expect(doubled.read()).toBe(5);

  count.update((x) => x + 1);

  expect(doubled.read()).toBe(6);
});

test("values are only tracked when accessed with .track()", () => {
  const a = state(5);
  const b = state(10);

  const multiplied = computed(() => a.track() * b.read());

  expect(multiplied.read()).toBe(50);

  a.update((x) => x + 1);

  expect(multiplied.read()).toBe(60);

  b.update((x) => x + 1);

  expect(multiplied.read()).toBe(60);
});

test("solves diamond problem", () => {
  const count = state(1);

  const left = computed(() => count.track() + 5);
  const right = computed(() => count.track() / 2);

  const sum = computed(() => left.track() + right.track());

  const fn = vi.fn(() => {
    sum.track();
  });
  const unsubscribe = watch(fn);

  expect(fn).toBeCalledTimes(1);

  count.update((x) => x + 1);
  batch(() => {
    count.update((x) => x + 1);
    count.update((x) => x + 1);
  });

  expect(fn).toBeCalledTimes(3);
  unsubscribe();
});

test("nested memo", () => {
  const count = state(0);

  const plus1 = (source: Readable<number>) => {
    return computed(() => source.track() + 1);
  };

  const one = plus1(count);
  const two = plus1(one);
  const three = plus1(two);

  const fn = vi.fn(() => {
    three.track();
  });
  const stop = watch(fn);

  expect(fn).toBeCalledTimes(1);

  expect(one.read()).toBe(1);
  expect(two.read()).toBe(2);
  expect(three.read()).toBe(3);

  count.update((x) => x + 1);

  expect(fn).toBeCalledTimes(2);

  expect(one.read()).toBe(2);
  expect(two.read()).toBe(3);
  expect(three.read()).toBe(4);

  stop();
});

test("effect runs cleanup function", () => {
  const fn = vi.fn();
  const count = state(0);

  const stop = watch(() => {
    count.track();
    return fn;
  });
  expect(fn).toBeCalledTimes(0);

  count.write(2);
  expect(fn).toBeCalledTimes(1);

  count.write(3);
  expect(fn).toBeCalledTimes(2);

  stop();
});
