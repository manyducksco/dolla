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

  test("accepts trace as a log level", () => {
    setLogLevel("trace");
    setLogLevel("info");
  });
});
