import { describe, expect, test, vi } from "vitest";
import { batch, computed, watch, get, Reactive, state, reader, nextValue, AbortError } from "./reactive";

test("basic composition & tracking", () => {
  const count = state(5);
  const doubled = computed(() => count.track() * 2);

  const same = reader(count); // just so happens to follow the signature of a memo; creates a Signal with the same value
  expect(same.get()).toBe(5);

  expect(count.get()).toBe(5);
  expect(get(doubled)).toBe(10);
  expect(doubled.get()).toBe(10);

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
  expect(same.get()).toBe(9);

  stop();
});

test("readables returned from computed function are unwrapped", () => {
  const count = state(5);
  const doubled = computed(() => count);

  expect(doubled.get()).toBe(5);

  count.update((x) => x + 1);

  expect(doubled.get()).toBe(6);
});

test("values are only tracked when accessed with .track()", () => {
  const a = state(5);
  const b = state(10);

  const multiplied = computed(() => a.track() * b.get());

  expect(multiplied.get()).toBe(50);

  a.update((x) => x + 1);

  expect(multiplied.get()).toBe(60);

  b.update((x) => x + 1);

  expect(multiplied.get()).toBe(60);
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

  const plus1 = (source: Reactive<number>) => {
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

  expect(one.get()).toBe(1);
  expect(two.get()).toBe(2);
  expect(three.get()).toBe(3);

  count.update((x) => x + 1);

  expect(fn).toBeCalledTimes(2);

  expect(one.get()).toBe(2);
  expect(two.get()).toBe(3);
  expect(three.get()).toBe(4);

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

  count.set(2);
  expect(fn).toBeCalledTimes(1);

  count.set(3);
  expect(fn).toBeCalledTimes(2);

  stop();
});

describe("nextValue", () => {
  test("receives the next value and then stops listening", () => {
    const fn = vi.fn();
    const count = state(120);

    nextValue(count).then(fn);

    count.set(121);
    count.set(122);
    count.set(123);

    Promise.resolve().then(() => {
      expect(fn).toBeCalledWith(121);
    });
  });

  test("receives next value that passes the filter", () => {
    const fn = vi.fn();
    const count = state(120);

    nextValue(count, {
      filter: (value) => value % 2 === 0,
    }).then(fn);

    count.set(121);
    count.set(122);
    count.set(123);

    Promise.resolve().then(() => {
      expect(fn).toBeCalledWith(122);
    });
  });

  test.skip("abort signal aborts listener", async () => {
    const onThen = vi.fn();
    const onCatch = vi.fn();
    const count = state(120);

    const controller = new AbortController();

    nextValue(count, {
      signal: controller.signal,
    })
      .then(onThen)
      .catch(onCatch);

    controller.abort();

    count.set(121);
    count.set(122);
    count.set(123);

    Promise.resolve().then(() => {
      expect(onThen).not.toBeCalled();
      expect(onCatch).toBeCalledTimes(1);
      expect(onCatch).toBeCalledWith(AbortError);
    });
  });

  // TODO: Test abort signal
});

// describe("subscribe", () => {
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
// });
