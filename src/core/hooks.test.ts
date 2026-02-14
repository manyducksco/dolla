import { beforeEach, describe, expect, test, vi } from "vitest";
import { Context, LifecycleEvent } from "../core/context";
import { getCurrentContext, setCurrentContext, signal } from "../core/signals";
import { $effect, $setup, $teardown, $on } from "./hooks";

const _emitWillMount = () => Context.emit(getCurrentContext()!, LifecycleEvent.WILL_MOUNT);
const _emitDidMount = () => Context.emit(getCurrentContext()!, LifecycleEvent.DID_MOUNT);
const _emitWillUnmount = () => Context.emit(getCurrentContext()!, LifecycleEvent.WILL_UNMOUNT);
const _emitDidUnmount = () => Context.emit(getCurrentContext()!, LifecycleEvent.DID_UNMOUNT);
const _emitDispose = () => Context.emit(getCurrentContext()!, LifecycleEvent.DISPOSE);

beforeEach(() => {
  setCurrentContext(new Context("test"));
});

// describe("useSignal", () => {
//   test("stores state", () => {
//     const [value, setValue] = useSignal(0);
//     expect(value()).toBe(0);

//     setValue(20);
//     expect(value()).toBe(20);

//     setValue((current) => current + 1);
//     expect(value()).toBe(21);
//   });
// });

// describe("useMemo", () => {
//   test("with auto tracking", () => {
//     const [left, setLeft] = useSignal(5);
//     const [right, setRight] = useSignal(8);
//     const added = useMemo(() => left() + right());

//     expect(added()).toBe(13);

//     setLeft(15);
//     expect(added()).toBe(23);

//     setRight((n) => n + 2);
//     expect(added()).toBe(25);
//   });

//   test("with explicit deps", () => {
//     const [left, setLeft] = useSignal(5);
//     const [right, setRight] = useSignal(8);
//     const added = useMemo(() => left() + right(), [right]);

//     expect(added()).toBe(13);

//     setLeft(15);
//     expect(added()).toBe(13);

//     setRight((n) => n + 2);
//     expect(added()).toBe(25);
//   });

//   test("receives previous value as first argument", () => {
//     const [count, setCount] = useSignal(1);

//     const fn = vi.fn((prev) => count() * 2);
//     const doubled = useMemo(fn);

//     expect(fn).toBeCalledTimes(0);
//     doubled();
//     expect(fn).toBeCalledTimes(1);
//     expect(fn).toBeCalledWith(undefined);
//     setCount(5);
//     doubled();
//     expect(fn).toBeCalledTimes(2);
//     expect(fn).toBeCalledWith(2);
//     setCount(10);
//     doubled();
//     expect(fn).toBeCalledTimes(3);
//     expect(fn).toBeCalledWith(10);
//   });
// });

describe("$effect", () => {
  test("effects are active while context is mounted", () => {
    const name = signal("Bon");

    const fn = vi.fn(() => {
      name();
    });
    $effect(fn);

    expect(fn).toBeCalledTimes(0);

    // Effects are started at WILL_MOUNT
    _emitWillMount();
    expect(fn).toBeCalledTimes(1);

    _emitDidMount();
    name("Tux");
    expect(fn).toBeCalledTimes(2);

    _emitWillUnmount();
    name("Abby");
    expect(fn).toBeCalledTimes(3);

    // Effects are stopped at DID_UNMOUNT
    _emitDidUnmount();
    name("Lacey");
    expect(fn).toBeCalledTimes(3); // still 3

    _emitDispose();
    name("Jack");
    expect(fn).toBeCalledTimes(3); // still 3
  });

  test("with auto tracking", () => {
    const left = signal(5);
    const right = signal(8);

    const fn = vi.fn(() => {
      left();
      right();
    });
    $effect(fn);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);

    left(15);
    expect(fn).toBeCalledTimes(2);

    right((n) => n + 2);
    expect(fn).toBeCalledTimes(3);
  });

  test("with explicit deps", () => {
    const left = signal(5);
    const right = signal(8);

    const fn = vi.fn(() => {
      left();
      right();
    });
    $effect(fn, [right]);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);

    left(15); // untracked value does not trigger it
    expect(fn).toBeCalledTimes(1);

    right((n) => n + 2);
    expect(fn).toBeCalledTimes(2);
  });

  test("cleanup function called between invocations and on unmount", () => {
    const count = signal(0);

    const cleanup = vi.fn();
    const fn = vi.fn(() => {
      count();
      return cleanup;
    });
    $effect(fn);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);
    expect(cleanup).toBeCalledTimes(0);

    count((n) => n + 1);

    expect(fn).toBeCalledTimes(2);
    expect(cleanup).toBeCalledTimes(1);

    count((n) => n + 1);

    expect(fn).toBeCalledTimes(3);
    expect(cleanup).toBeCalledTimes(2);

    _emitWillUnmount();
    _emitDidUnmount();

    expect(fn).toBeCalledTimes(3);
    expect(cleanup).toBeCalledTimes(3); // cleanup called again but effect function is not
  });
});

describe("$setup", () => {
  test("called on mount, returned function called on unmount", () => {
    const onUnmount = vi.fn();
    const onMount = vi.fn(() => onUnmount);
    $setup(onMount);

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

describe("$teardown", () => {
  test("called on DID_UNMOUNT", () => {
    const onUnmount = vi.fn();
    $teardown(onUnmount);

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
