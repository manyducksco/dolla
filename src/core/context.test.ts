import { describe, expect, test, vi } from "vitest";
import {
  addStore,
  cleanupContext,
  createContext,
  getStore,
  hasOwnStore,
  hasStore,
  mountContext,
  onCleanup,
  onMount,
  type Context,
} from "./context.js";

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

describe("stores", () => {
  function CounterStore(this: Context) {
    let count = 0;
    return {
      increment: () => count++,
      getCount: () => count,
    };
  }

  function ConfigStore(this: Context, props: { theme: string }) {
    return { theme: props.theme };
  }

  test("addStore returns the store value", () => {
    const ctx = createContext(null);
    const store = addStore(ctx, CounterStore);
    expect(store).toBeDefined();
    expect(typeof store.increment).toBe("function");
  });

  test("getStore retrieves the store", () => {
    const ctx = createContext(null);
    addStore(ctx, CounterStore);
    const store = getStore(ctx, CounterStore);
    expect(store.getCount()).toBe(0);
    store.increment();
    expect(store.getCount()).toBe(1);
  });

  test("getStore walks up the context chain", () => {
    const parent = createContext(null);
    addStore(parent, CounterStore);
    const child = createContext(parent);
    const store = getStore(child, CounterStore);
    expect(store.getCount()).toBe(0);
  });

  test("child store shadows parent store", () => {
    const parent = createContext(null);
    addStore(parent, CounterStore);
    const child = createContext(parent);
    addStore(child, CounterStore);
    const parentStore = getStore(parent, CounterStore);
    const childStore = getStore(child, CounterStore);
    parentStore.increment();
    expect(parentStore.getCount()).toBe(1);
    expect(childStore.getCount()).toBe(0);
  });

  test("addStore with props passes them to the store function", () => {
    const ctx = createContext(null);
    const store = addStore(ctx, ConfigStore, { theme: "dark" });
    expect(store.theme).toBe("dark");
  });

  test("addStore with no props uses undefined", () => {
    const ctx = createContext(null);
    const store = addStore(ctx, CounterStore);
    expect(store).toBeDefined();
  });

  test("adding the same store twice on the same context throws", () => {
    const ctx = createContext(null);
    addStore(ctx, CounterStore);
    expect(() => addStore(ctx, CounterStore)).toThrow("Store was already provided on this context.");
  });

  test("hasStore returns true when store exists on context chain", () => {
    const parent = createContext(null);
    addStore(parent, CounterStore);
    const child = createContext(parent);
    expect(hasStore(parent, CounterStore)).toBe(true);
    expect(hasStore(child, CounterStore)).toBe(true);
  });

  test("hasStore returns false when store does not exist", () => {
    const ctx = createContext(null);
    expect(hasStore(ctx, CounterStore)).toBe(false);
  });

  test("hasOwnStore returns true only for direct store", () => {
    const parent = createContext(null);
    addStore(parent, CounterStore);
    const child = createContext(parent);
    expect(hasOwnStore(parent, CounterStore)).toBe(true);
    expect(hasOwnStore(child, CounterStore)).toBe(false);
  });

  test("getStore throws when store is not available", () => {
    const ctx = createContext(null);
    expect(() => getStore(ctx, CounterStore)).toThrow("Store 'CounterStore' is not provided by this context.");
  });

  test("store receives its own sub-context with correct name", () => {
    let capturedContext: any;
    function NamedStore(this: Context, _props: {}, ctx: Context) {
      capturedContext = ctx;
      return { value: 1 };
    }
    Object.defineProperty(NamedStore, "name", { value: "MyStore" });
    const ctx = createContext(null);
    addStore(ctx, NamedStore, {});
    expect(capturedContext.name).toBe("MyStore");
  });

  test("mounting parent context calls mount on store sub-context", () => {
    const mountSpy = vi.fn();
    function StoreWithHook(this: Context, _props: {}, ctx: Context) {
      onMount(ctx, mountSpy);
      return {};
    }
    const ctx = createContext(null);
    addStore(ctx, StoreWithHook, {});
    expect(mountSpy).not.toHaveBeenCalled();
    mountContext(ctx);
    expect(mountSpy).toHaveBeenCalledTimes(1);
  });

  test("cleaning parent context calls cleanup on store sub-context", () => {
    const cleanupSpy = vi.fn();
    function StoreWithHook(this: Context, _props: {}, ctx: Context) {
      onCleanup(ctx, cleanupSpy);
      return {};
    }
    const ctx = createContext(null);
    addStore(ctx, StoreWithHook, {});
    mountContext(ctx);
    expect(cleanupSpy).not.toHaveBeenCalled();
    cleanupContext(ctx);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});
