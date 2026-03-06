import { beforeEach, describe, expect, test, vi } from "vitest";
import { Context } from "./context.js";
import { getCurrentContext, setCurrentContext } from "./context.js";
import { $setup, $teardown, $effect } from "./hooks";
import { state } from "./reactive";

const _mount = () => getCurrentContext()!.mount();
const _unmount = () => getCurrentContext()!.unmount();

beforeEach(() => {
  setCurrentContext(new Context("test"));
});

describe("$watch", () => {
  test("effects are active while context is mounted", () => {
    const [name, setName] = state("Bon");

    const fn = vi.fn(() => {
      name();
    });
    $effect(fn);

    expect(fn).toBeCalledTimes(0);

    _mount();
    setName("Tux");
    expect(fn).toBeCalledTimes(1);

    setName("Abby");
    expect(fn).toBeCalledTimes(2);

    // Effects are stopped at unmount
    _unmount();
    setName("Lacey");
    expect(fn).toBeCalledTimes(2); // still 2
    setName("Jack");
    expect(fn).toBeCalledTimes(2); // still 2
  });

  test("with auto tracking", () => {
    const [left, setLeft] = state(5);
    const [right, setRight] = state(8);

    const fn = vi.fn(() => {
      left();
      right();
    });
    $effect(fn);

    _mount();

    expect(fn).toBeCalledTimes(1);

    setLeft(15);
    expect(fn).toBeCalledTimes(2);

    setLeft((n) => n + 2);
    expect(fn).toBeCalledTimes(3);
  });

  test("cleanup function called between invocations and on unmount", () => {
    const [count, setCount] = state(0);

    const cleanup = vi.fn();
    const fn = vi.fn(() => {
      count();
      return cleanup;
    });
    $effect(fn);

    _mount();

    expect(fn).toBeCalledTimes(1);
    expect(cleanup).toBeCalledTimes(0);

    setCount((n) => n + 1);

    expect(fn).toBeCalledTimes(2);
    expect(cleanup).toBeCalledTimes(1);

    setCount((n) => n + 1);

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
