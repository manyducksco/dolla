import { describe, expect, test, vi } from "vitest";
import { setErrorHandler, type SignalError } from "./errors.js";
import {
  addStore,
  cleanupContext,
  createContext,
  getStore,
  hasOwnStore,
  hasStore,
  isMounted,
  mountContext,
  onCleanup,
  onEffect,
  onMount,
  type Context,
} from "./context.js";
import { createAtom } from "./signals.js";
import { __dolla_export } from "./hmr.js";

test("lifecycle", () => {
  const c = createContext(null);

  const mountSpy = vi.fn();
  const cleanupSpy = vi.fn();

  onMount(c, mountSpy);
  onCleanup(c, cleanupSpy);

  // No callbacks called yet.
  expect(isMounted(c)).toBe(false);
  expect(mountSpy).not.toHaveBeenCalled();
  expect(cleanupSpy).not.toHaveBeenCalled();

  // Mounted state is set and callbacks have run.
  mountContext(c);
  expect(isMounted(c)).toBe(true);
  expect(mountSpy).toHaveBeenCalledTimes(1);
  expect(cleanupSpy).not.toHaveBeenCalled();

  // Unmounted state is set and callbacks have run.
  cleanupContext(c);
  expect(isMounted(c)).toBe(false);
  expect(mountSpy).toHaveBeenCalledTimes(1);
  expect(cleanupSpy).toHaveBeenCalledTimes(1);
});

describe("onEffect", () => {
  test("returns a function that stops the effect early", () => {
    const c = createContext(null);
    const [value, setValue] = createAtom(0);
    const runs = vi.fn();

    const stop = onEffect(c, () => runs(value()));
    mountContext(c);
    expect(runs).toHaveBeenCalledTimes(1);

    stop();
    setValue(1);
    expect(runs).toHaveBeenCalledTimes(1);
    cleanupContext(c);
  });

  test("stopping before mount keeps the effect from starting", () => {
    const c = createContext(null);
    const runs = vi.fn();

    onEffect(c, runs)();
    mountContext(c);
    expect(runs).not.toHaveBeenCalled();
    cleanupContext(c);
  });
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

  test("adding the same store twice on the same context returns existing store", () => {
    const ctx = createContext(null);
    const first = addStore(ctx, CounterStore);
    const second = addStore(ctx, CounterStore);
    expect(second).toBe(first);
  });

  test("addStore re-registers lifecycle listeners on re-registration", () => {
    const ctx = createContext(null);
    const mountSpy = vi.fn();
    function StoreWithHook(this: Context, _props: {}, storeCtx: Context) {
      onMount(storeCtx, mountSpy);
      return {};
    }

    // First registration: store function runs, registers its own mount hook
    addStore(ctx, StoreWithHook, {});
    mountContext(ctx);
    expect(mountSpy).toHaveBeenCalledTimes(1);

    // Cleanup tears down everything including store sub-context
    cleanupContext(ctx);

    // Re-registration re-wires parent's mount/cleanup listeners
    addStore(ctx, StoreWithHook, {});

    // Mount cascades to store sub-context again
    mountContext(ctx);
    // mountSpy won't fire — the store function wasn't re-called, so
    // storeContext.MOUNT_LISTENERS was cleared during cleanup and never
    // re-registered. Only the parent's listener was re-registered.
    expect(mountSpy).toHaveBeenCalledTimes(1);

    // But cleanup should still cascade properly
    const cleanupSpy = vi.fn();
    onCleanup(ctx, cleanupSpy);
    cleanupContext(ctx);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
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

describe("store identity", () => {
  function named<T extends Function>(name: string, fn: T): T {
    Object.defineProperty(fn, "name", { value: name });
    return fn;
  }

  test.each([
    ["a minified name", "e"],
    ["the name 'default'", "default"],
    ["an empty name", ""],
  ])("different stores with %s get separate instances", (_label, name) => {
    const ctx = createContext(null);
    const A = named(name, function (this: Context) {
      return { tag: "A" };
    });
    const B = named(name, function (this: Context) {
      return { tag: "B" };
    });

    expect(addStore(ctx, A).tag).toBe("A");
    expect(addStore(ctx, B).tag).toBe("B");
    expect(getStore(ctx, A).tag).toBe("A");
    expect(getStore(ctx, B).tag).toBe("B");
  });

  test("hasStore and hasOwnStore do not match a different store with the same name", () => {
    const parent = createContext(null);
    const child = createContext(parent);
    function AuthStore(this: Context) {
      return { id: "auth" };
    }
    const Impostor = named("AuthStore", function (this: Context) {
      return { id: "impostor" };
    });
    addStore(parent, AuthStore);

    expect(hasStore(child, AuthStore)).toBe(true);
    expect(hasStore(child, Impostor)).toBe(false);
    expect(hasOwnStore(parent, Impostor)).toBe(false);
    expect(() => getStore(child, Impostor)).toThrow();
  });

  test("two different store names get distinct instances", () => {
    const ctx = createContext(null);
    function AStore(this: Context) {
      return { tag: "A" };
    }
    function BStore(this: Context) {
      return { tag: "B" };
    }
    addStore(ctx, AStore);
    addStore(ctx, BStore);
    expect(getStore(ctx, AStore).tag).toBe("A");
    expect(getStore(ctx, BStore).tag).toBe("B");
  });

  test("the same store on two contexts gets independent instances", () => {
    const ctxA = createContext(null);
    const ctxB = createContext(null);
    function CounterStore(this: Context) {
      let n = 0;
      return { inc: () => ++n, get: () => n };
    }
    addStore(ctxA, CounterStore);
    addStore(ctxB, CounterStore);
    getStore(ctxA, CounterStore).inc();
    getStore(ctxA, CounterStore).inc();
    expect(getStore(ctxA, CounterStore).get()).toBe(2);
    expect(getStore(ctxB, CounterStore).get()).toBe(0);
  });

  describe("hot reload", () => {
    // The vite plugin wraps exported functions with `__dolla_export`, which
    // returns the same wrapper every time the module is re-evaluated.
    let reloadId = 0;
    function hotModule() {
      const id = `/src/stores.ts:AuthStore:${reloadId++}`;
      return (value: number) => {
        function AuthStore(this: Context) {
          return { id: "auth", value };
        }
        return __dolla_export(id, AuthStore as any) as typeof AuthStore;
      };
    }

    test("a reloaded store keeps the existing instance", () => {
      const load = hotModule();
      const ctx = createContext(null);
      const before = load(1);
      const first = addStore(ctx, before);

      const after = load(999); // module re-evaluated
      expect(after).toBe(before);
      expect(getStore(ctx, after)).toBe(first);
      expect(addStore(ctx, after)).toBe(first);
    });

    test("hasStore and hasOwnStore find a reloaded store", () => {
      const load = hotModule();
      const parent = createContext(null);
      addStore(parent, load(1));
      const child = createContext(parent);

      const reloaded = load(2);
      expect(hasStore(child, reloaded)).toBe(true);
      expect(hasOwnStore(parent, reloaded)).toBe(true);
      expect(hasOwnStore(child, reloaded)).toBe(false);
    });
  });

  test("continues cleanup after a throwing listener", () => {
    const errors: SignalError[] = [];
    setErrorHandler((error) => errors.push(error));

    const context = createContext(null);
    const order: number[] = [];
    mountContext(context);

    onCleanup(context, () => {
      order.push(1);
      throw new Error("cleanup boom");
    });
    onCleanup(context, () => {
      order.push(2);
    });

    expect(() => cleanupContext(context)).not.toThrow();
    expect(order).toEqual([1, 2]);
    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe("unmount");

    setErrorHandler(null);
  });
});
