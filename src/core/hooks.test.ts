import { beforeEach, describe, expect, test, vi } from "vitest";
import { Context } from "./context.js";
import { getCurrentContext, setCurrentContext } from "./context.js";
import { $setup, $teardown, $watch } from "./hooks";
import { state } from "./reactive";

const _mount = () => getCurrentContext()!.mount();
const _unmount = () => getCurrentContext()!.unmount();

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

    _mount();
    name.set("Tux");
    expect(fn).toBeCalledTimes(1);

    name.set("Abby");
    expect(fn).toBeCalledTimes(2);

    // Effects are stopped at unmount
    _unmount();
    name.set("Lacey");
    expect(fn).toBeCalledTimes(2); // still 2
    name.set("Jack");
    expect(fn).toBeCalledTimes(2); // still 2
  });

  test("with auto tracking", () => {
    const left = state(5);
    const right = state(8);

    const fn = vi.fn(() => {
      left.track();
      right.track();
    });
    $watch(fn);

    _mount();

    expect(fn).toBeCalledTimes(1);

    left.set(15);
    expect(fn).toBeCalledTimes(2);

    left.set((n) => n + 2);
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

    _mount();

    expect(fn).toBeCalledTimes(1);
    expect(cleanup).toBeCalledTimes(0);

    count.set((n) => n + 1);

    expect(fn).toBeCalledTimes(2);
    expect(cleanup).toBeCalledTimes(1);

    count.set((n) => n + 1);

    expect(fn).toBeCalledTimes(3);
    expect(cleanup).toBeCalledTimes(2);

    _unmount();

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
    _mount();
    expect(onMount).toBeCalledTimes(1);
    expect(onUnmount).toBeCalledTimes(0);
    _unmount();
    expect(onMount).toBeCalledTimes(1);
    expect(onUnmount).toBeCalledTimes(1);
  });
});

describe("$teardown", () => {
  test("called on DID_UNMOUNT", () => {
    const onUnmount = vi.fn();
    $teardown(onUnmount);

    expect(onUnmount).toBeCalledTimes(0);
    _mount();
    expect(onUnmount).toBeCalledTimes(0);
    _unmount();
    expect(onUnmount).toBeCalledTimes(1);
  });
});
