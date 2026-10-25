import { afterEach, describe, expect, test, vi } from "vitest";
import { createContext, mountContext, onEffect, cleanupContext } from "./context";
import {
  batch,
  compose,
  createAtom,
  createEffect,
  peek,
  subscribe,
  type Getter,
} from "./signals";
import { pushComponentName, popComponentName, setSignalDebug } from "./signal-debug";
import { SignalError, isSignalError, setErrorHandler } from "./errors";

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

  function captureErrors(): SignalError[] {
    const errors: SignalError[] = [];
    setErrorHandler((error) => errors.push(error));
    return errors;
  }

  afterEach(() => {
    setErrorHandler(null);
    setSignalDebug(false);
  });

  test("enhances error in composed getter (lazy eval)", () => {
    const err = catchError(() => {
      const getter = compose(() => {
        throw new Error("nope");
      });
      getter();
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("Reactive context");
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
    expect(err.message).toContain("Reactive context");
    expect(err.message).toContain('composed "bad"');
    expect(err.message).toContain("two is bad");
  });

  test("reports error in effect initial execution and detaches the effect", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(0);
    const runs: number[] = [];

    expect(() => {
      createEffect(() => {
        runs.push(a());
        throw new Error("effect boom");
      });
    }).not.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(SignalError);
    expect(errors[0].message).toContain("Reactive context");
    expect(errors[0].message).toContain('effect "(anonymous)"');

    setA(1);
    expect(runs).toEqual([0]);
  });

  test("reports error in effect on re-run without throwing from the setter", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(1);

    createEffect(() => {
      a();
      if (a() === 2) throw new Error("re-run boom");
    });

    expect(() => setA(2)).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Reactive context");
    expect(errors[0].message).toContain('effect "(anonymous)"');
    expect(errors[0].trigger.length).toBeGreaterThan(0);
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
    const errors = captureErrors();

    expect(() => {
      createEffect(() => { throw new Error("effect named"); }, { name: "MyEffect" });
    }).not.toThrow();

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('effect "MyEffect"');
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
    const matches = err.message.match(/Reactive context/g);
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

  test("omits creation frame when signal debug is disabled", () => {
    const err = catchError(() => {
      const getter = compose(() => {
        throw new Error("frame test");
      });
      getter();
    });

    expect(err.message).not.toContain("created at");
  });

  test("includes creation frame when signal debug is enabled", () => {
    setSignalDebug(true);

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
    expect(err.message).toContain("Reactive context");
    expect(err.message).toContain('composed "inner"');
    expect(err.message).toContain('composed "outer"');
  });

  test("enhances error in peek", () => {
    const getter = compose(() => {
      throw new Error("peeked");
    });

    const err = catchError(() => peek(() => getter()));
    expect(err.message).toContain("Reactive context");
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
    expect(err.message).toContain("Reactive context");
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

  test("does not stop other effects when one throws", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(0);
    const log: string[] = [];

    createEffect(() => {
      const value = a();
      log.push(`bad:${value}`);
      if (value === 1) throw new Error("boom");
    });

    createEffect(() => {
      log.push(`good:${a()}`);
    });

    expect(() => setA(1)).not.toThrow();
    expect(log).toEqual(["bad:0", "good:0", "bad:1", "good:1"]);
    expect(errors).toHaveLength(1);

    // The failed effect stays subscribed and retries on the next change.
    setA(2);
    expect(log).toEqual(["bad:0", "good:0", "bad:1", "good:1", "bad:2", "good:2"]);
  });

  test("cleanup errors do not block the new body or orphan the effect", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(0);
    const log: string[] = [];

    createEffect(() => {
      const value = a();
      log.push(`body:${value}`);
      return () => {
        log.push(`cleanup:${value}`);
        if (value === 0) throw new Error("cleanup boom");
      };
    });

    expect(() => setA(1)).not.toThrow();
    setA(2);

    expect(log).toEqual(["body:0", "cleanup:0", "body:1", "cleanup:1", "body:2"]);
    expect(errors).toHaveLength(1);
  });

  test("computed errors are sticky until a dependency changes", () => {
    const [a, setA] = createAtom(0);
    const value = compose(() => {
      const current = a();
      if (current === 1) throw new Error("bad computed");
      return current;
    });

    expect(value()).toBe(0);
    setA(1);

    expect(() => value()).toThrow(SignalError);
    expect(() => value()).toThrow(SignalError);

    setA(2);
    expect(value()).toBe(2);
  });

  test("parent effects retry after a computed recovers", () => {
    const [a, setA] = createAtom(0);
    const value = compose(() => {
      if (a() === 1) throw new Error("no value");
      return a();
    });

    const seen: number[] = [];
    createEffect(() => {
      try {
        seen.push(value());
      } catch {
        // The effect itself recovers on the next dependency change.
      }
    });

    setA(1);
    setA(2);

    expect(seen).toEqual([0, 2]);
  });

  test("failed subscribe initial execution detaches and returns a no-op", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(0);
    const calls: number[] = [];

    const unsubscribe = subscribe(a, (value) => {
      calls.push(value);
      throw new Error("subscribe boom");
    });

    expect(calls).toEqual([0]);
    expect(errors).toHaveLength(1);

    setA(1);
    expect(calls).toEqual([0]);
    unsubscribe();
  });

  test("reports async effect callbacks as unsupported", () => {
    const errors = captureErrors();

    createEffect(async () => {
      await Promise.resolve();
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("must be synchronous");
  });

  test("preserves the batch callback error when an effect also fails", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(0);

    createEffect(() => {
      if (a() === 1) throw new Error("effect boom");
    });

    expect(() =>
      batch(() => {
        setA(1);
        throw new Error("callback boom");
      }),
    ).toThrow("callback boom");

    expect(errors).toHaveLength(1);
  });

  test("direct setter updater errors still throw", () => {
    const [a, setA] = createAtom(0);

    const error = catchError(() =>
      setA(() => {
        throw new Error("updater boom");
      }),
    );

    expect(error).toBeInstanceOf(SignalError);
    expect((error as SignalError).phase).toBe("setter");
    expect(error.message).toContain("updater boom");
    expect(a()).toBe(0);
  });

  test("exposes the structured error through SignalError", () => {
    const errors = captureErrors();
    const [a, setA] = createAtom(0);

    createEffect(() => {
      if (a() === 1) throw new RangeError("bad range");
    });

    setA(1);

    const error = errors[0];
    expect(isSignalError(error)).toBe(true);
    expect(error.cause).toBeInstanceOf(RangeError);
    expect(error.original).toBeInstanceOf(RangeError);
    expect(error.phase).toBe("effect");
    expect(error.stack).toContain("bad range");
  });
});
