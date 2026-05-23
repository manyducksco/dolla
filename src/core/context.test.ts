import { expect, test, vi } from "vitest";
import { cleanupContext, createContext, mountContext, onCleanup, onMount } from "./context.js";

test("lifecycle", () => {
  const c = createContext(null);

  const mountSpy = vi.fn();
  const cleanupSpy = vi.fn();

  onMount(c, mountSpy);
  onCleanup(c, cleanupSpy);

  // No callbacks called yet.
  expect(c.isMounted).toBe(false);
  expect(mountSpy).not.toHaveBeenCalled();
  expect(cleanupSpy).not.toHaveBeenCalled();

  // Mounted state is set and callbacks have run.
  mountContext(c);
  expect(c.isMounted).toBe(true);
  expect(mountSpy).toHaveBeenCalledTimes(1);
  expect(cleanupSpy).not.toHaveBeenCalled();

  // Unmounted state is set and callbacks have run.
  cleanupContext(c);
  expect(c.isMounted).toBe(false);
  expect(mountSpy).toHaveBeenCalledTimes(1);
  expect(cleanupSpy).toHaveBeenCalledTimes(1);
});
