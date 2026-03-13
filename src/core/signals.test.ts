import { describe, expect, test, vi } from "vitest";
import { createContext, mountContext, onEffect, unmountContext } from "./context";
import { batch, effect, memo, peek, state, subscribe, type Getter } from "./signals";

test("basic composition & tracking", () => {
  const count = state(5);
  const doubled = memo(() => count() * 2);

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
    count((c) => c + 1);
    count((c) => c + 1);
    count((c) => c + 1);
    count((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);

  stop();
});

test("mutable computed state", () => {
  const name = state("Bon");
  const inputValue = state(() => name());

  const spy = vi.fn();
  const stop = effect(() => {
    spy(inputValue());
  });

  expect(spy).toBeCalledTimes(1);
  expect(spy).toBeCalledWith("Bon");
  expect(inputValue()).toBe("Bon");
  expect(name()).toBe("Bon");

  inputValue("Charals");

  expect(spy).toBeCalledTimes(2);
  expect(spy).toBeCalledWith("Charals");
  expect(inputValue()).toBe("Charals");
  expect(name()).toBe("Bon");

  name("Jack");

  expect(spy).toBeCalledTimes(3);
  expect(spy).toBeCalledWith("Jack");
  expect(inputValue()).toBe("Jack");
  expect(name()).toBe("Jack");

  stop();
});

test("effect cleanup", () => {
  const count = state(5);

  const spy = vi.fn();
  const stop = effect(() => {
    count(); // triggers each time count changes
    return spy; // return a function to clean up
  });

  expect(spy).toBeCalledTimes(0);

  count(6);

  expect(spy).toBeCalledTimes(1);

  stop();

  expect(spy).toBeCalledTimes(2);
});

test("setting via accessor will take the value", () => {
  const count = state(500);
  const other = state(36);
  const val = state(12);

  count(other);

  expect(count()).toBe(36);
  expect(other()).toBe(36);

  other(50);

  expect(count()).toBe(36);
  expect(other()).toBe(50);

  val(count);

  expect(count()).toBe(36);
  expect(val()).toBe(36);
});

test("effects bind to the given context", () => {
  const count = state(0);

  const spy = vi.fn();

  const context = createContext();
  onEffect(context, () => {
    spy(count());
  });

  // Context not mounted yet; effect should be suspended.
  expect(spy).toBeCalledTimes(0);

  count(5);

  expect(spy).toBeCalledTimes(0);

  mountContext(context);

  expect(spy).toBeCalledTimes(1);

  count(40);

  expect(spy).toBeCalledTimes(2);

  // suspendContext(context);

  // count((c) => c + 1);
  // expect(spy).toBeCalledTimes(2); // not called while suspended

  // resumeContext(context);

  // expect(spy).toBeCalledTimes(3); // called again when resumed

  unmountContext(context);

  count((c) => c + 1);
  expect(spy).toBeCalledTimes(2);
});

test("values are not tracked when accessed with peek()", () => {
  const a = state(5);
  const b = state(10);

  const multiplied = memo(() => a() * peek(b));

  expect(multiplied()).toBe(50);

  a((x) => x + 1);

  expect(multiplied()).toBe(60);

  b((x) => x + 1);

  expect(multiplied()).toBe(60);
});

test("solves diamond problem", () => {
  const count = state(1);

  const left = memo(() => count() + 5);
  const right = memo(() => count() / 2);

  const sum = memo(() => left() + right());

  const fn = vi.fn(() => {
    sum();
  });
  const unsubscribe = effect(fn);

  expect(fn).toBeCalledTimes(1);

  count((x) => x + 1);
  batch(() => {
    count((x) => x + 1);
    count((x) => x + 1);
  });

  expect(fn).toBeCalledTimes(3);
  unsubscribe();
});

test("nested memo", () => {
  const count = state(0);

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

  count((x) => x + 1);

  expect(fn).toBeCalledTimes(2);

  expect(one()).toBe(2);
  expect(two()).toBe(3);
  expect(three()).toBe(4);

  stop();
});

describe("subscribe", () => {
  // test("immediately cancelling doesn't crash", () => {
  //   const fn = vi.fn();
  //   const count = state(5);
  //   expect(() => {
  //     const cancel = subscribe(count, (value) => {
  //       fn(value);
  //       cancel();
  //     });
  //   }).not.toThrowError();
  //   expect(fn).toHaveBeenCalledTimes(1);
  //   count((current) => current + 1);
  //   expect(fn).toHaveBeenCalledTimes(1);
  // });

  test("ignores tracked values in callback", () => {
    const count = state(5);
    const other = state("hi");
    const fn = vi.fn();
    const unsub = subscribe(count, (value) => {
      other(); // trackable getter
      fn();
      return value * 2;
    });
    expect(fn).toBeCalledTimes(1);
    count(12);
    expect(fn).toBeCalledTimes(2); // tracked `count` has updated
    other("hello");
    expect(fn).toBeCalledTimes(2); // `other` is not tracked
    unsub();
  });
});
