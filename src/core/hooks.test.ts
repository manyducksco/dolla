import { beforeEach, describe, expect, test, vi } from "vitest";
import { Context, getCurrentContext, LifecycleEvent, setCurrentContext } from "../core/context";
import { $setup, $teardown, $watch } from "./hooks";
import { state } from "./signal";

const _emitWillMount = () => getCurrentContext()!.emit(LifecycleEvent.WILL_MOUNT);
const _emitDidMount = () => getCurrentContext()!.emit(LifecycleEvent.DID_MOUNT);
const _emitWillUnmount = () => getCurrentContext()!.emit(LifecycleEvent.WILL_UNMOUNT);
const _emitDidUnmount = () => getCurrentContext()!.emit(LifecycleEvent.DID_UNMOUNT);
const _emitDispose = () => getCurrentContext()!.emit(LifecycleEvent.DISPOSE);

beforeEach(() => {
  setCurrentContext(new Context("test"));
});

describe("$watch", () => {
  test("effects are active while context is mounted", () => {
    const name = state("Bon");

    const fn = vi.fn(() => {
      name.track();
    });
    $watch(fn);

    expect(fn).toBeCalledTimes(0);

    // Effects are started at WILL_MOUNT
    _emitWillMount();
    expect(fn).toBeCalledTimes(1);

    _emitDidMount();
    name.write("Tux");
    expect(fn).toBeCalledTimes(2);

    _emitWillUnmount();
    name.write("Abby");
    expect(fn).toBeCalledTimes(3);

    // Effects are stopped at DID_UNMOUNT
    _emitDidUnmount();
    name.write("Lacey");
    expect(fn).toBeCalledTimes(3); // still 3

    _emitDispose();
    name.write("Jack");
    expect(fn).toBeCalledTimes(3); // still 3
  });

  test("with auto tracking", () => {
    const left = state(5);
    const right = state(8);

    const fn = vi.fn(() => {
      left.track();
      right.track();
    });
    $watch(fn);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);

    left.write(15);
    expect(fn).toBeCalledTimes(2);

    left.update((n) => n + 2);
    expect(fn).toBeCalledTimes(3);
  });

  test("cleanup function called between invocations and on unmount", () => {
    const count = state(0);

    const cleanup = vi.fn();
    const fn = vi.fn(() => {
      count.track();
      return cleanup;
    });
    $watch(fn);

    _emitWillMount();
    _emitDidMount();

    expect(fn).toBeCalledTimes(1);
    expect(cleanup).toBeCalledTimes(0);

    count.update((n) => n + 1);

    expect(fn).toBeCalledTimes(2);
    expect(cleanup).toBeCalledTimes(1);

    count.update((n) => n + 1);

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
