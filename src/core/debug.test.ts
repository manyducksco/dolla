import { afterEach, describe, expect, test, vi } from "vitest";
import { createContext } from "./context.js";
import { getDebug, setLogLevel } from "./debug.js";

describe("getDebug", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("logging from a context without a name does not throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const context = createContext(null);
    expect(() => getDebug(context).warn("message")).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  test("uses the context's current name after it changes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const context = createContext(null);
    context.name = "First";
    const debug = getDebug(context);

    debug.warn("one");
    context.name = "Second";
    debug.warn("two");

    expect(warn.mock.calls[0][0]).toContain("First");
    expect(warn.mock.calls[1][0]).toContain("Second");
  });

  test("trace logs only appear at the trace level", () => {
    const trace = vi.spyOn(console, "trace").mockImplementation(() => {});
    const context = createContext(null);
    context.name = "Tracer";
    try {
      setLogLevel("warn");
      getDebug(context).trace("hidden");
      expect(trace).not.toHaveBeenCalled();

      setLogLevel("trace");
      getDebug(context).trace("shown");
      expect(trace).toHaveBeenCalledTimes(1);
    } finally {
      setLogLevel("info");
    }
  });
});
