import { describe, expect, test, vi } from "vitest";
import { createContext, mountContext, onEffect, cleanupContext } from "./context";
import {
  batch,
  compose,
  createAtom,
  createEffect,
  peek,
  pushComponentName,
  popComponentName,
  subscribe,
  type Getter,
} from "./signals";

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

test("setters return the new value", () => {
  const [count, setCount] = createAtom(2);
  const [doubled, setDoubled] = createAtom(() => count() * 2);

  expect(setCount(3)).toBe(3);
  expect(count()).toBe(3);

  expect(doubled()).toBe(6);
  expect(setDoubled(51)).toBe(51);
  expect(doubled()).toBe(51);

  expect(setCount((current) => current + 1)).toBe(4);
  expect(count()).toBe(4);

  expect(doubled()).toBe(8);
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

  const context = createContext(null);
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

  cleanupContext(context);

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

describe("error enhancement", () => {
  function catchError(fn: () => void): Error {
    try {
      fn();
      throw new Error("did not throw");
    } catch (e: any) {
      return e;
    }
  }

  test("enhances error in composed getter (lazy eval)", () => {
    const err = catchError(() => {
      const getter = compose(() => {
        throw new Error("nope");
      });
      getter();
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("--- Reactive context ---");
    expect(err.message).toContain('composed "(anonymous)"');
  });

  test("enhances error in composed getter on re-evaluation", () => {
    const [a, setA] = createAtom(1);
    const getter = compose(function double() {
      return a() * 2;
    });

    // prime the cache
    getter();

    const bad = compose(function bad() {
      if (a() === 2) throw new RangeError("two is bad");
      return a();
    });

    // prime the cache
    bad();

    // now change a — bad will re-evaluate on next read
    setA(2);

    const err = catchError(() => bad());
    expect(err.message).toContain("--- Reactive context ---");
    expect(err.message).toContain('composed "bad"');
    expect(err.message).toContain("two is bad");
  });

  test("enhances error in effect initial execution", () => {
    const err = catchError(() => {
      createEffect(() => {
        throw new Error("effect boom");
      });
    });

    expect(err.message).toContain("--- Reactive context ---");
    expect(err.message).toContain('effect "(anonymous)"');
  });

  test("enhances error in effect on re-run", () => {
    const [a, setA] = createAtom(1);

    createEffect(() => {
      a();
      if (a() === 2) throw new Error("re-run boom");
    });

    const err = catchError(() => setA(2));
    expect(err.message).toContain("--- Reactive context ---");
    expect(err.message).toContain('effect "(anonymous)"');
  });

  test("uses options.name override for compose", () => {
    const err = catchError(() => {
      const getter = compose(() => { throw new Error("named"); }, { name: "MyGreatGetter" });
      getter();
    });

    expect(err.message).toContain('composed "MyGreatGetter"');
  });

  test("uses options.name override for createAtom with getter", () => {
    const err = catchError(() => {
      const [getter] = createAtom(() => { throw new Error("atom boom"); }, { name: "MyAtom" });
      getter();
    });

    expect(err.message).toContain('composed "MyAtom"');
  });

  test("uses options.name override for createEffect", () => {
    const err = catchError(() => {
      createEffect(() => { throw new Error("effect named"); }, { name: "MyEffect" });
    });

    expect(err.message).toContain('effect "MyEffect"');
  });

  test("createEffect accepts bare deps array for backwards compat", () => {
    const [a, setA] = createAtom(0);
    let result = 0;

    createEffect(
      (v: number) => { result = v; },
      [a],
    );

    expect(result).toBe(0);
    setA(42);
    expect(result).toBe(42);
  });

  test("includes component name via push/pop", () => {
    pushComponentName("UserProfile");

    const err = catchError(() => {
      const getter = compose(() => {
        throw new Error("in profile");
      });
      getter();
    });

    popComponentName();

    expect(err.message).toContain('composed "UserProfile → (anonymous)"');
  });

  test("does not double-enhance the same error", () => {
    const err = catchError(() => {
      const inner = compose(function inner() {
        throw new Error("once");
      });
      const outer = compose(function outer() {
        return inner();
      });
      outer();
    });

    // Message should contain the reactive context exactly once
    const matches = err.message.match(/--- Reactive context ---/g);
    expect(matches).toHaveLength(1);
    expect(err.message).toContain('composed "inner"');
    expect(err.message).toContain('composed "outer"');
  });

  test("preserves original message and stack in error.cause", () => {
    const err = catchError(() => {
      const getter = compose(() => {
        throw new Error("original message");
      });
      getter();
    });

    expect(err.cause).toBeInstanceOf(Error);
    expect((err.cause as Error).message).toBe("original message");
    expect((err.cause as Error).stack).toBeDefined();
  });

  test("includes creation frame in reactive context", () => {
    const err = catchError(() => {
      const getter = compose(() => {
        throw new Error("frame test");
      });
      getter();
    });

    expect(err.message).toContain("created at");
  });

  test("enhances error in nested composed chain", () => {
    const inner = compose(function inner() {
      throw new Error("deep");
    });

    const outer = compose(function outer() {
      return inner();
    });

    const err = catchError(() => outer());
    expect(err.message).toContain("--- Reactive context ---");
    expect(err.message).toContain('composed "inner"');
    expect(err.message).toContain('composed "outer"');
  });

  test("enhances error in peek", () => {
    const getter = compose(() => {
      throw new Error("peeked");
    });

    const err = catchError(() => peek(() => getter()));
    expect(err.message).toContain("--- Reactive context ---");
    expect(err.message).toContain('composed "(anonymous)"');
  });

  test("abbreviates long chains", () => {
    const [s, set] = createAtom(0);

    // Build a chain s → c1 → c2 → ... → c8 where c1 throws when s === 1.
    // First-time eval of c8 pushes all 8 composes onto the scope stack.
    const c1 = compose(function c1() {
      if (s() === 1) throw new Error("c1 err");
      return s();
    });
    const c2 = compose(function c2() {
      return c1();
    });
    const c3 = compose(function c3() {
      return c2();
    });
    const c4 = compose(function c4() {
      return c3();
    });
    const c5 = compose(function c5() {
      return c4();
    });
    const c6 = compose(function c6() {
      return c5();
    });
    const c7 = compose(function c7() {
      return c6();
    });
    const c8 = compose(function c8() {
      return c7();
    });

    set(1);

    const err = catchError(() => c8());
    expect(err.message).toContain("--- Reactive context ---");
    // first 3
    expect(err.message).toContain('1 → composed "c8"');
    expect(err.message).toContain('2 → composed "c7"');
    expect(err.message).toContain('3 → composed "c6"');
    // abbreviation
    expect(err.message).toContain("... (2 more)");
    // last 3
    expect(err.message).toContain('6 → composed "c3"');
    expect(err.message).toContain('7 → composed "c2"');
    expect(err.message).toContain('8 → composed "c1"');
  });
});
