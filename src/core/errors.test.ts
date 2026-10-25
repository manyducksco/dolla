import { afterEach, describe, expect, test, vi } from "vitest";
import {
  isSignalError,
  reportSignalError,
  runSafely,
  setErrorHandler,
  toSignalError,
  SignalError,
} from "./errors.js";
import { compose, createAtom, createEffect } from "./signals.js";

describe("SignalError", () => {
  afterEach(() => {
    setErrorHandler(null);
    vi.restoreAllMocks();
  });

  test("preserves the original Error and stack", () => {
    const original = new RangeError("bad range");
    const error = toSignalError(original, { phase: "computed" });

    expect(error).toBeInstanceOf(SignalError);
    expect(error.cause).toBe(original);
    expect(error.original).toBe(original);
    expect(error.message).toContain("bad range");
    expect(isSignalError(error)).toBe(true);
  });

  test("normalizes non-Error throws", () => {
    const original = { reason: "nope" };
    const error = toSignalError(original, { phase: "effect" });

    expect(error).toBeInstanceOf(SignalError);
    expect(error.original).toBe(original);
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error & { cause?: unknown }).cause).toBe(original);
  });

  test("does not double-wrap an existing SignalError", () => {
    const original = new Error("once");
    const first = toSignalError(original, { phase: "computed" });
    const second = toSignalError(first, { phase: "effect" });

    expect(second).toBe(first);
    expect(second.message.match(/Reactive context/g) ?? []).toHaveLength(0);
  });

  test("does not mutate frozen errors", () => {
    const original = Object.freeze(new Error("frozen"));
    const error = toSignalError(original, { phase: "effect" });

    expect(error.cause).toBe(original);
    expect((original as any)._dollaEnhanced).toBeUndefined();
  });

  test("includes reactive context and trigger frames", () => {
    const errors: SignalError[] = [];
    setErrorHandler((error) => errors.push(error));

    const [count, setCount] = createAtom(0);
    createEffect(() => {
      if (count() === 1) throw new Error("boom");
    });

    function trigger() {
      setCount(1);
    }
    trigger();

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Reactive context");
    expect(errors[0].message).toContain("Triggered from");
    expect(errors[0].trigger.join("\n")).toContain("trigger");
  });

  test("includes computed names and abbreviated scope chains", () => {
    const inner = compose(function inner() {
      throw new Error("deep");
    });
    const outer = compose(function outer() {
      return inner();
    });

    const error = (() => {
      try {
        outer();
      } catch (error) {
        return error as SignalError;
      }
      throw new Error("did not throw");
    })();

    expect(error).toBeInstanceOf(SignalError);
    expect(error.message).toContain('composed "inner"');
    expect(error.message).toContain('composed "outer"');
  });

  test("reports the handler error without recursing when a handler throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    setErrorHandler(() => {
      throw new Error("handler boom");
    });

    const original = toSignalError(new Error("original"), { phase: "effect" });

    expect(() => reportSignalError(original)).not.toThrow();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toContain("handler boom");
  });

  test("runSafely reports and continues", () => {
    const errors: SignalError[] = [];
    setErrorHandler((error) => errors.push(error));

    let continued = false;
    runSafely(
      () => {
        throw new Error("cleanup boom");
      },
      { phase: "unmount" },
    );
    continued = true;

    expect(continued).toBe(true);
    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe("unmount");
  });

  test("supports a cross-bundle brand check", () => {
    const foreign = { [Symbol.for("dolla.SignalError")]: true };

    expect(isSignalError(foreign)).toBe(true);
  });
});
