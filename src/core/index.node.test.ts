// @vitest-environment node
import { expect, test } from "vitest";

test("the main entry can be imported without a DOM", async () => {
  expect(typeof document).toBe("undefined");
  const mod = await import("./index.js");
  expect(typeof mod.css).toBe("function");
  expect(typeof mod.createRoot).toBe("function");
});
