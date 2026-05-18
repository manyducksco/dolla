import { describe, expect, test, vi } from "vitest";
import { createContext, mountContext, onEffect, unmountContext } from "./context";
import { batch, compose, createAtom, createEffect, createStream, peek, subscribe, type Getter } from "./signals";

test("basic composition & tracking", () => {
  const [count, setCount] = createAtom(5);
  const doubled = compose(() => count() * 2);

  expect(count()).toBe(5);
  expect(peek(doubled)).toBe(10);
  expect(doubled()).toBe(10);

  const fn = vi.fn(() => {
    doubled();
  });
  const stop = createEffect(fn);

  expect(fn).toBeCalledTimes(1);

  // Effects should not run until end of batch.
  batch(() => {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);

  stop();
});

test("mutable computed state", () => {
  const [name, setName] = createAtom("Bon");
  const [inputValue, setInputValue] = createAtom(() => name());

  const spy = vi.fn();
  const stop = createEffect(() => {
    spy(inputValue());
  });

  expect(spy).toBeCalledTimes(1);
  expect(spy).toBeCalledWith("Bon");
  expect(inputValue()).toBe("Bon");
  expect(name()).toBe("Bon");

  setInputValue("Charals");

  expect(spy).toBeCalledTimes(2);
  expect(spy).toBeCalledWith("Charals");
  expect(inputValue()).toBe("Charals");
  expect(name()).toBe("Bon");

  setName("Jack");

  expect(spy).toBeCalledTimes(3);
  expect(spy).toBeCalledWith("Jack");
  expect(inputValue()).toBe("Jack");
  expect(name()).toBe("Jack");

  stop();
});

test("effect cleanup", () => {
  const [count, setCount] = createAtom(5);

  const spy = vi.fn();
  const stop = createEffect(() => {
    count(); // triggers each time count changes
    return spy; // return a function to clean up
  });

  expect(spy).toBeCalledTimes(0);

  setCount(6);

  expect(spy).toBeCalledTimes(1);

  stop();

  expect(spy).toBeCalledTimes(2);
});

test("setting via accessor will take the value", () => {
  const [count, setCount] = createAtom(500);
  const [other, setOther] = createAtom(36);
  const [val, setVal] = createAtom(12);

  setCount(other);

  expect(count()).toBe(36);
  expect(other()).toBe(36);

  setOther(50);

  expect(count()).toBe(36);
  expect(other()).toBe(50);

  setVal(count);

  expect(count()).toBe(36);
  expect(val()).toBe(36);
});

test("effects bind to the given context", () => {
  const [count, setCount] = createAtom(0);

  const spy = vi.fn();

  const context = createContext();
  onEffect(context, () => {
    spy(count());
  });

  // Context not mounted yet; effect should be suspended.
  expect(spy).toBeCalledTimes(0);

  setCount(5);

  expect(spy).toBeCalledTimes(0);

  mountContext(context);

  expect(spy).toBeCalledTimes(1);

  setCount(40);

  expect(spy).toBeCalledTimes(2);

  // suspendContext(context);

  // count((c) => c + 1);
  // expect(spy).toBeCalledTimes(2); // not called while suspended

  // resumeContext(context);

  // expect(spy).toBeCalledTimes(3); // called again when resumed

  unmountContext(context);

  setCount((c) => c + 1);
  expect(spy).toBeCalledTimes(2);
});

test("values are not tracked when accessed with peek()", () => {
  const [a, setA] = createAtom(5);
  const [b, setB] = createAtom(10);

  const multiplied = compose(() => a() * peek(b));

  expect(multiplied()).toBe(50);

  setA((x) => x + 1);

  expect(multiplied()).toBe(60);

  setB((x) => x + 1);

  expect(multiplied()).toBe(60);
});

test("solves diamond problem", () => {
  const [count, setCount] = createAtom(1);

  const left = compose(() => count() + 5);
  const right = compose(() => count() / 2);

  const sum = compose(() => left() + right());

  const fn = vi.fn(() => {
    sum();
  });
  const unsubscribe = createEffect(fn);

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
  const [count, setCount] = createAtom(0);

  const plus1 = (source: Getter<number>) => {
    return compose(() => source() + 1);
  };

  const one = plus1(count);
  const two = plus1(one);
  const three = plus1(two);

  const fn = vi.fn(() => {
    three();
  });
  const stop = createEffect(fn);

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
    const [count, setCount] = createAtom(5);
    const [other, setOther] = createAtom("hi");
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

describe("streams", () => {
  test("map, reduce, filter", () => {
    const [values, emitValue] = createStream({ initialValue: 5 });

    const sum = values.reduce((sum, number) => sum + number, 0);
    const doubled = values.map((number) => number * 2);
    const evens = values.filter((number) => number % 2 === 0);

    expect(sum.latest).toBe(5);
    expect(doubled.latest).toBe(10);
    expect(evens.latest).toBe(undefined);

    emitValue(6);

    expect(sum.latest).toBe(11);
    expect(doubled.latest).toBe(12);
    expect(evens.latest).toBe(6);

    emitValue(7);

    expect(sum.latest).toBe(18);
    expect(doubled.latest).toBe(14);
    expect(evens.latest).toBe(6);
  });

  test("delay", async () => {
    const [values, emit] = createStream({ initialValue: 1 });

    const delayed = values.delay(10);

    expect(delayed.latest).toBe(1);

    await sleep(11);
    expect(delayed.latest).toBe(1);

    emit(2);
    expect(delayed.latest).toBe(1);

    await sleep(11);
    expect(delayed.latest).toBe(2);
  });

  test("debounce", async () => {
    const [values, emit] = createStream({ initialValue: 1 });

    const debounced = values.debounce(10);

    const spy = vi.fn();
    const cleanup = createEffect(() => {
      spy(debounced.current());
    });

    expect(debounced.latest).toBe(1);
    expect(spy).toBeCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(1);

    emit(2);
    emit(3);
    emit(4);
    emit(5); // only this one should trigger an update after 10ms

    await sleep(11); // wait for debounce to take effect

    expect(debounced.latest).toBe(5);
    expect(spy).toBeCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(5);

    cleanup();
  });

  test("throttle", async () => {
    const [values, emit] = createStream({ initialValue: 1 });

    const throttled = values.throttle(10);

    const spy = vi.fn();
    const cleanup = createEffect(() => {
      spy(throttled.current());
    });

    expect(throttled.latest).toBe(1);
    expect(spy).toBeCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(1);

    emit(2); // this one goes through
    emit(3); // ignored
    emit(4); // ignored

    expect(spy).toBeCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(2);

    await sleep(11);

    emit(5); // goes through
    emit(6); // ignored

    expect(spy).toBeCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith(5);

    await sleep(11);

    // unchanged:
    expect(spy).toBeCalledTimes(3);
    expect(spy).toHaveBeenLastCalledWith(5);

    cleanup();
  });

  test("next", async () => {
    const [values, emit] = createStream({ initialValue: 1 });

    const spy = vi.fn();
    values.next().then(spy);

    await sleep(0); // wait for promise to resolve

    expect(spy).toBeCalledTimes(0);

    emit(2);

    await sleep(0); // wait for promise to resolve

    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith(2);

    emit(3);
    expect(spy).toBeCalledTimes(1); // not called again
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
