import { test, expect, vi } from "vitest";
import { createState, derive } from "../dist/index.js";

test("signal", () => {
  const [$count, setCount] = createState(5);

  const defaultWatcher = vi.fn();
  const stopDefault = $count.watch(defaultWatcher);

  const lazyWatcher = vi.fn();
  const stopLazy = $count.watch(lazyWatcher, { lazy: true });

  expect(defaultWatcher).toBeCalledTimes(1);
  expect(lazyWatcher).toBeCalledTimes(0);

  expect($count.get()).toBe(5);

  setCount(12);

  expect($count.get()).toBe(12);

  expect(defaultWatcher).toBeCalledTimes(2);
  expect(lazyWatcher).toBeCalledTimes(1);

  expect(defaultWatcher).toBeCalledWith(12);
  expect(lazyWatcher).toBeCalledWith(12);

  setCount(12);

  // Not called again; same value.
  expect(defaultWatcher).toBeCalledTimes(2);
  expect(lazyWatcher).toBeCalledTimes(1);

  stopDefault();
  stopLazy();

  setCount(51);

  // Not called again; stopped.
  expect(defaultWatcher).toBeCalledTimes(2);
  expect(lazyWatcher).toBeCalledTimes(1);
});

test("derive", () => {
  const [$one, setOne] = createState(5);
  const [$two, setTwo] = createState(20);

  const deriveSum = vi.fn((one, two) => one + two);
  const deriveProduct = vi.fn((one, two) => one * two);

  const $sum = derive([$one, $two], deriveSum);
  const $product = derive([$one, $two], deriveProduct);

  expect($sum.get()).toBe(25);
  expect($product.get()).toBe(100);

  expect(deriveSum).toBeCalledTimes(1);

  $sum.get();
  $sum.get();
  $sum.get();

  expect(deriveSum).toBeCalledTimes(1);

  const defaultWatcher = vi.fn();
  const stopDefault = $sum.watch(defaultWatcher);

  const lazyWatcher = vi.fn();
  const stopLazy = $product.watch(lazyWatcher, { lazy: true });

  expect(defaultWatcher).toBeCalledTimes(1);
  expect(lazyWatcher).toBeCalledTimes(0);

  expect(defaultWatcher).toBeCalledWith(25);

  setOne(6);

  expect(defaultWatcher).toBeCalledTimes(2);
  expect(lazyWatcher).toBeCalledTimes(1);

  expect(defaultWatcher).toBeCalledWith(26);
  expect(lazyWatcher).toBeCalledWith(120);

  setTwo(20);

  expect(deriveSum).toBeCalledTimes(3);

  // Not called again; same value.
  expect(defaultWatcher).toBeCalledTimes(2);
  expect(lazyWatcher).toBeCalledTimes(1);

  stopDefault();
  stopLazy();

  setOne(4);

  // Not called again; stopped.
  expect(defaultWatcher).toBeCalledTimes(2);
  expect(lazyWatcher).toBeCalledTimes(1);

  expect($sum.get()).toBe(24);
  expect($product.get()).toBe(80);

  expect(deriveSum).toBeCalledTimes(4);
});

test("derive nested signals", () => {
  const [$value, setValue] = createState(5);

  const [$object, setObject] = createState({
    href: derive([$value], (value) => `/projects/${value}/test`),
  });

  // o.href here is itself a derived value
  const $href = derive([$object], (o) => o.href);

  const watcher = vi.fn();
  const stop = $href.watch(watcher);

  expect(watcher).toBeCalledTimes(1);
  expect(watcher).toBeCalledWith("/projects/5/test");

  // Update value which href depends on.
  setValue(12);

  expect(watcher).toBeCalledTimes(2);
  expect(watcher).toBeCalledWith("/projects/12/test");

  // Now set the original object and replace the derived href.
  // See that watcher still receives the latest value.
  setObject({
    href: derive([$value], (value) => `/projects/${value}/changed`),
  });

  expect(watcher).toBeCalledTimes(3);
  expect(watcher).toBeCalledWith("/projects/12/changed");

  stop();
});
