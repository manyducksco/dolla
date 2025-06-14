import { beforeEach, describe, test, expect, vi } from "vitest";
import { useState, useMemo, useEffect, useReducer, useRef, useMount, useUnmount, ReducerFn } from "./index";
import { getCurrentContext, setCurrentContext } from "../core/signals";
import { Context, LifecycleEvent } from "../core/context";

const _emitWillMount = () => Context.emit(getCurrentContext()!, LifecycleEvent.WILL_MOUNT);
const _emitDidMount = () => Context.emit(getCurrentContext()!, LifecycleEvent.DID_MOUNT);
const _emitWillUnmount = () => Context.emit(getCurrentContext()!, LifecycleEvent.WILL_UNMOUNT);
const _emitDidUnmount = () => Context.emit(getCurrentContext()!, LifecycleEvent.DID_UNMOUNT);
const _emitDispose = () => Context.emit(getCurrentContext()!, LifecycleEvent.DISPOSE);

beforeEach(() => {
  setCurrentContext(new Context("test"));
});

describe("useState", () => {
  test("stores state", () => {
    const [value, setValue] = useState(0);
    expect(value()).toBe(0);

    setValue(20);
    expect(value()).toBe(20);

    setValue((current) => current + 1);
    expect(value()).toBe(21);
  });
});

describe("useMemo", () => {
  test("with auto tracking", () => {
    const [left, setLeft] = useState(5);
    const [right, setRight] = useState(8);
    const added = useMemo(() => left() + right());

    expect(added()).toBe(13);

    setLeft(15);
    expect(added()).toBe(23);

    setRight((n) => n + 2);
    expect(added()).toBe(25);
  });

  test("with explicit deps", () => {
    const [left, setLeft] = useState(5);
    const [right, setRight] = useState(8);
    const added = useMemo(() => left() + right(), [right]);

    expect(added()).toBe(13);

    setLeft(15);
    expect(added()).toBe(13);

    setRight((n) => n + 2);
    expect(added()).toBe(25);
  });

  test("receives previous value as first argument", () => {
    const [count, setCount] = useState(1);

    const fn = vi.fn((prev) => count() * 2);
    const doubled = useMemo(fn);

    expect(fn).toBeCalledTimes(0);
    doubled();
    expect(fn).toBeCalledTimes(1);
    expect(fn).toBeCalledWith(undefined);
    setCount(5);
    doubled();
    expect(fn).toBeCalledTimes(2);
    expect(fn).toBeCalledWith(2);
    setCount(10);
    doubled();
    expect(fn).toBeCalledTimes(3);
    expect(fn).toBeCalledWith(10);
  });
});

describe("useEffect", () => {
  test("effects are active while context is mounted", () => {
    const [name, setName] = useState("Bon");

    const fn = vi.fn(() => {
      name();
    });
    useEffect(fn);

    expect(fn).toBeCalledTimes(0);

    // Effects are started at WILL_MOUNT
    _emitWillMount();
    expect(fn).toBeCalledTimes(1);

    _emitDidMount();
    setName("Tux");
    expect(fn).toBeCalledTimes(2);

    _emitWillUnmount();
    setName("Abby");
    expect(fn).toBeCalledTimes(3);

    // Effects are stopped at DID_UNMOUNT
    _emitDidUnmount();
    setName("Lacey");
    expect(fn).toBeCalledTimes(3); // still 3

    _emitDispose();
    setName("Jack");
    expect(fn).toBeCalledTimes(3); // still 3
  });

  test("with auto tracking", () => {
    const [left, setLeft] = useState(5);
    const [right, setRight] = useState(8);

    const fn = vi.fn(() => {
      left();
      right();
    });
    useEffect(fn);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);

    setLeft(15);
    expect(fn).toBeCalledTimes(2);

    setRight((n) => n + 2);
    expect(fn).toBeCalledTimes(3);
  });

  test("with explicit deps", () => {
    const [left, setLeft] = useState(5);
    const [right, setRight] = useState(8);

    const fn = vi.fn(() => {
      left();
      right();
    });
    useEffect(fn, [right]);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);

    setLeft(15); // untracked value does not trigger it
    expect(fn).toBeCalledTimes(1);

    setRight((n) => n + 2);
    expect(fn).toBeCalledTimes(2);
  });

  test("cleanup function called between invocations and on unmount", () => {
    const [count, setCount] = useState(0);

    const cleanup = vi.fn();
    const fn = vi.fn(() => {
      count();
      return cleanup;
    });
    useEffect(fn);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);
    expect(cleanup).toBeCalledTimes(0);

    setCount((n) => n + 1);

    expect(fn).toBeCalledTimes(2);
    expect(cleanup).toBeCalledTimes(1);

    setCount((n) => n + 1);

    expect(fn).toBeCalledTimes(3);
    expect(cleanup).toBeCalledTimes(2);

    _emitWillUnmount();
    _emitDidUnmount();

    expect(fn).toBeCalledTimes(3);
    expect(cleanup).toBeCalledTimes(3); // cleanup called again but effect function is not
  });
});

describe("useReducer", () => {
  test("updates state via dispatched actions", () => {
    type State = number;
    type Action = "increment" | "decrement" | "reset";

    const reducer: ReducerFn<State, Action> = (state, action) => {
      switch (action) {
        case "increment":
          return state + 1;
        case "decrement":
          return state - 1;
        case "reset":
          return 0;
      }
    };

    const [count, dispatch] = useReducer(reducer, 0);

    expect(count()).toBe(0);

    dispatch("increment");
    expect(count()).toBe(1);

    dispatch("increment");
    expect(count()).toBe(2);

    dispatch("reset");
    expect(count()).toBe(0);

    dispatch("decrement");
    expect(count()).toBe(-1);
  });
});

describe("useRef", () => {
  test("function & object syntax are equal", () => {
    const value = useRef("TEST");

    expect(value()).toBe("TEST");
    expect(value.current).toBe("TEST");

    value("FUNCTION");
    expect(value()).toBe("FUNCTION");
    expect(value.current).toBe("FUNCTION");

    value.current = "OBJECT";
    expect(value()).toBe("OBJECT");
    expect(value.current).toBe("OBJECT");
  });

  test("throws error if accessed with empty value", () => {
    const value = useRef();

    expect(() => value()).toThrowError();
    expect(() => value.current).toThrowError();

    // Not empty
    value.current = undefined;
    expect(() => value()).not.toThrowError();
    expect(() => value.current).not.toThrowError();

    // Also not empty
    value.current = null;
    expect(() => value()).not.toThrowError();
    expect(() => value.current).not.toThrowError();
  });
});

describe("useMount", () => {
  test("called on mount, returned function called on unmount", () => {
    const onUnmount = vi.fn();
    const onMount = vi.fn(() => onUnmount);
    useMount(onMount);

    expect(onMount).toBeCalledTimes(0);
    expect(onUnmount).toBeCalledTimes(0);
    _emitWillMount();
    expect(onMount).toBeCalledTimes(0);
    expect(onUnmount).toBeCalledTimes(0);
    _emitDidMount();
    expect(onMount).toBeCalledTimes(1);
    expect(onUnmount).toBeCalledTimes(0);
    _emitWillUnmount();
    expect(onMount).toBeCalledTimes(1);
    expect(onUnmount).toBeCalledTimes(0);
    _emitDidUnmount();
    expect(onMount).toBeCalledTimes(1);
    expect(onUnmount).toBeCalledTimes(1);
    _emitDispose();
    expect(onMount).toBeCalledTimes(1);
    expect(onUnmount).toBeCalledTimes(1);
  });
});

describe("useUnmount", () => {
  test("called on DID_UNMOUNT", () => {
    const onUnmount = vi.fn();
    useUnmount(onUnmount);

    expect(onUnmount).toBeCalledTimes(0);
    _emitWillMount();
    expect(onUnmount).toBeCalledTimes(0);
    _emitDidMount();
    expect(onUnmount).toBeCalledTimes(0);
    _emitWillUnmount();
    expect(onUnmount).toBeCalledTimes(0);
    _emitDidUnmount();
    expect(onUnmount).toBeCalledTimes(1);
    _emitDispose();
    expect(onUnmount).toBeCalledTimes(1);
  });
});
