import { beforeEach, describe, expect, test, vi } from "vitest";
import { Context, getActiveContext, setActiveContext } from "./context.js";
import { $setup, $teardown } from "./hooks";

const _mount = () => getActiveContext()!.mount();
const _unmount = () => getActiveContext()!.unmount();

beforeEach(() => {
  setActiveContext(new Context("test"));
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
