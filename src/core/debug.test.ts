import { afterEach, describe, expect, test, vi } from "vitest";
import { createContext } from "./context.js";
import { getDebug } from "./debug.js";

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
});
