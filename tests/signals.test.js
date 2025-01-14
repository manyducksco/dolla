import test from "node:test";
import assert from "node:assert";

import { createSignal, derive } from "../dist/index.js";

test("signal", (t) => {
  const [$count, setCount] = createSignal(5);

  const defaultWatcher = t.mock.fn();
  const stopDefault = $count.watch(defaultWatcher);

  const lazyWatcher = t.mock.fn();
  const stopLazy = $count.watch(lazyWatcher, { lazy: true });

  assert.equal(defaultWatcher.mock.callCount(), 1, "watcher is called immediately by default");
  assert.equal(lazyWatcher.mock.callCount(), 0, "lazy watcher is not called immediately");

  assert.equal($count.get(), 5, "get returns the initial value");

  setCount(12);

  assert.equal($count.get(), 12, "setter updates the signal value");

  assert.equal(defaultWatcher.mock.callCount(), 2, "default watcher is called");
  assert.equal(lazyWatcher.mock.callCount(), 1, "lazy watcher is called");

  assert.deepStrictEqual(defaultWatcher.mock.calls[1].arguments, [12], "default watcher is called with new value");
  assert.deepStrictEqual(lazyWatcher.mock.calls[0].arguments, [12], "lazy watcher is called with new value");

  setCount(12);

  assert.equal(defaultWatcher.mock.callCount(), 2, "default watcher was not called with same value");
  assert.equal(lazyWatcher.mock.callCount(), 1, "lazy watcher was not called with same value");

  stopDefault();
  stopLazy();

  setCount(51);

  assert.equal(defaultWatcher.mock.callCount(), 2, "default watcher has not been called again");
  assert.equal(lazyWatcher.mock.callCount(), 1, "lazy watcher has not been called again");
});

test("derive", (t) => {
  const [$one, setOne] = createSignal(5);
  const [$two, setTwo] = createSignal(20);

  const deriveSum = t.mock.fn((one, two) => one + two);
  const deriveProduct = t.mock.fn((one, two) => one * two);

  const $sum = derive([$one, $two], deriveSum);
  const $product = derive([$one, $two], deriveProduct);

  assert.equal($sum.get(), 25, "sum is calculated correctly");
  assert.equal($product.get(), 100, "product is calculated correctly");

  assert.equal(deriveSum.mock.callCount(), 1, "derive function has only been called once");

  $sum.get();
  $sum.get();
  $sum.get();

  assert.equal(deriveSum.mock.callCount(), 1, "derive function still only called once as dependencies haven't changed");

  const defaultWatcher = t.mock.fn();
  const stopDefault = $sum.watch(defaultWatcher);

  const lazyWatcher = t.mock.fn();
  const stopLazy = $product.watch(lazyWatcher, { lazy: true });

  assert.equal(defaultWatcher.mock.callCount(), 1, "default watcher has been called");
  assert.equal(lazyWatcher.mock.callCount(), 0, "lazy watcher has not been called yet");

  assert.deepStrictEqual(defaultWatcher.mock.calls[0].arguments, [25], "default watcher was called with initial value");

  setOne(6);

  assert.equal(defaultWatcher.mock.callCount(), 2, "default watcher has been called");
  assert.equal(lazyWatcher.mock.callCount(), 1, "lazy watcher has been called");

  assert.deepStrictEqual(defaultWatcher.mock.calls[1].arguments, [26], "default watcher was called with new value");
  assert.deepStrictEqual(lazyWatcher.mock.calls[0].arguments, [120], "lazy watcher was called with new value");

  setTwo(20);

  assert.equal(defaultWatcher.mock.callCount(), 2, "default watcher was not called with same value");
  assert.equal(lazyWatcher.mock.callCount(), 1, "lazy watcher was not called with same value");

  stopDefault();
  stopLazy();

  setOne(4);

  assert.equal(defaultWatcher.mock.callCount(), 2, "default watcher was not called after stop");
  assert.equal(lazyWatcher.mock.callCount(), 1, "lazy watcher was not called after stop");

  assert.equal($sum.get(), 24, "sum is derived correctly");
  assert.equal($product.get(), 80, "product is derived correctly");

  assert.equal(deriveSum.mock.callCount(), 3, "sum has only been derived three times");
});

test("derive nested signals", (t) => {
  const [$value, setValue] = createSignal(5);

  const [$object, setObject] = createSignal({
    href: derive([$value], (value) => `/projects/${value}/test`),
  });

  // o.href here is itself a derived value
  const $href = derive([$object], (o) => o.href);

  const watcher = t.mock.fn();
  const stop = $href.watch(watcher);

  assert.equal(watcher.mock.callCount(), 1);
  assert.deepStrictEqual(watcher.mock.calls[0].arguments, ["/projects/5/test"]);

  // Update value which href depends on.
  setValue(12);

  assert.equal(watcher.mock.callCount(), 2);
  assert.deepStrictEqual(watcher.mock.calls[1].arguments, ["/projects/12/test"]);

  // Now set the original object and replace the derived href.
  // See that watcher still receives the latest value.
  setObject({
    href: derive([$value], (value) => `/projects/${value}/changed`),
  });

  assert.equal(watcher.mock.callCount(), 3);
  assert.deepStrictEqual(watcher.mock.calls[2].arguments, ["/projects/12/changed"]);

  stop();
});
