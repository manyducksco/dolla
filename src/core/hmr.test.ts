import { describe, expect, test, vi } from "vitest";
import { addStore, createContext, getStore } from "./context.js";
import { __dolla_apply, __dolla_export, __dolla_store, registerViewInstance, unregisterViewInstance } from "./hmr.js";

let viewCounter = 0;
function makeView(name: string) {
  return __dolla_export(`/test/${viewCounter++}.tsx:${name}`, function () {
    return name;
  }) as any;
}

function makeMockNode(opts: { mounted?: boolean; root?: Element | null } = {}) {
  const calls: string[] = [];
  const mounted = opts.mounted ?? true;
  return {
    calls,
    replaceView(newView: any) {
      calls.push(newView());
    },
    isMounted: () => mounted,
    getRoot: () => opts.root ?? null,
  } as any;
}

describe("HMR __dolla_export", () => {
  test("keeps properties attached to the exported function", () => {
    const log = function (this: any, msg: string) {
      return `${this?.level ?? "log"}: ${msg}`;
    } as any;
    log.info = (msg: string) => log.call({ level: "info" }, msg);

    const live = __dolla_export(`/test/${viewCounter++}.ts:log`, log) as any;

    expect(live("hi")).toBe("log: hi");
    expect(live.info("hi")).toBe("info: hi");
  });

  test("updates attached properties on hot reload", () => {
    const id = `/test/${viewCounter++}.ts:log`;
    const first = Object.assign(() => "first", { info: () => "first info", old: true });
    const second = Object.assign(() => "second", { info: () => "second info" });

    const live = __dolla_export(id, first) as any;
    __dolla_export(id, second);

    expect(live()).toBe("second");
    expect(live.info()).toBe("second info");
    expect("old" in live).toBe(false);
  });

  test("keeps its store identity when the new implementation was already used as a store", () => {
    const id = `/test/${viewCounter++}.ts:AuthStore`;
    const live = __dolla_export(id, () => ({ version: 1 })) as any;
    const oldRoot = createContext(null);
    const store = addStore(oldRoot, live);

    // In an import cycle the reloaded module's raw function can be used before the module wraps it.
    const next = () => ({ version: 2 });
    addStore(createContext(null), next);
    __dolla_export(id, next);

    expect(getStore(oldRoot, live)).toBe(store);
  });
});

describe("HMR __dolla_store", () => {
  test("gives a function the same store identity as its wrapper", () => {
    const id = `/test/${viewCounter++}.ts:AuthStore`;
    const raw = () => ({});
    const ctx = createContext(null);
    const store = addStore(ctx, __dolla_store(id, raw));

    expect(getStore(ctx, __dolla_export(id, raw) as any)).toBe(store);
  });

  test("a reloaded function used before its module wraps it still finds existing instances", () => {
    const id = `/test/${viewCounter++}.ts:AuthStore`;
    const live = __dolla_export(id, __dolla_store(id, () => ({ version: 1 }))) as any;
    const oldRoot = createContext(null);
    const oldStore = addStore(oldRoot, live);

    // The reloaded module's hoisted function runs before the module evaluates (import cycle).
    const next = () => ({ version: 2 });
    const newRoot = createContext(null);
    const newStore = addStore(newRoot, __dolla_store(id, next));
    __dolla_export(id, next);

    expect(getStore(oldRoot, __dolla_store(id, next))).toBe(oldStore);
    expect(getStore(newRoot, live)).toBe(newStore);
  });
});

describe("HMR __dolla_apply", () => {
  test("replaces all instances of the same view", () => {
    const view = makeView("Foo");
    const a = makeMockNode();
    const b = makeMockNode();
    const c = makeMockNode();
    registerViewInstance(view, a as any);
    registerViewInstance(view, b as any);
    registerViewInstance(view, c as any);

    const newView = makeView("Foo");
    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(a.calls).toEqual(["Foo"]);
    expect(b.calls).toEqual(["Foo"]);
    expect(c.calls).toEqual(["Foo"]);
  });

  test("survives a replaceView that throws", () => {
    const view = makeView("Foo");
    const a = makeMockNode();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const b = makeMockNode();
    (a as any).replaceView = () => {
      throw new Error("boom");
    };
    registerViewInstance(view, a as any);
    registerViewInstance(view, b as any);

    const newView = makeView("Foo");
    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(b.calls).toEqual(["Foo"]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("handles repeated keys without double-replacing the same instance", () => {
    const view = makeView("Foo");
    const a = makeMockNode();
    registerViewInstance(view, a as any);

    const newView = makeView("Foo");
    // Simulate a file that has both `Foo` and `default: Foo` in the HMR callback.
    __dolla_apply({ Foo: newView, "default: Foo": newView }, { Foo: view, "default: Foo": view });

    expect(a.calls).toEqual(["Foo"]);
  });

  test("skips non-function exports", () => {
    const view = makeView("Foo");
    const a = makeMockNode();
    registerViewInstance(view, a as any);

    const newView = makeView("Foo");
    const method: any = () => "x";
    // Should not throw even with a non-function export mixed in.
    __dolla_apply({ Foo: newView, Constant: 42, Method: method }, { Foo: view, Constant: 42, Method: method } as any);

    expect(a.calls).toEqual(["Foo"]);
  });

  test("unregisterViewInstance removes the node from the active set", () => {
    const view = makeView("Foo");
    const a = makeMockNode();
    const b = makeMockNode();
    registerViewInstance(view, a as any);
    registerViewInstance(view, b as any);

    unregisterViewInstance(view, a as any);

    const newView = makeView("Foo");
    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(a.calls).toEqual([]);
    expect(b.calls).toEqual(["Foo"]);
  });

  test("returns the same proxy on repeat __dolla_export with the same id", () => {
    const id = `/test/shared-${viewCounter++}.tsx:Foo`;
    const first = __dolla_export(id, function Foo() {
      return "x";
    }) as any;
    const second = __dolla_export(id, function Foo() {
      return "x";
    }) as any;
    expect(second).toBe(first);
    expect(second.__dolla_id).toBe(id);
  });

  test("logs file path and total elapsed time in the group header", () => {
    const view = makeView("Foo");
    registerViewInstance(view, makeMockNode());
    const newView = makeView("Foo");

    const groupSpy = vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(groupSpy).toHaveBeenCalledTimes(1);
    const header = groupSpy.mock.calls[0][0] as string;
    expect(header).toMatch(/\[dolla:hmr\] hot reload: 1 view instance across 1 export in \d+\.\d{2}ms/);

    groupSpy.mockRestore();
    logSpy.mockRestore();
  });

  test("logs file path, instance count, per-export time, and old → new name when names differ", () => {
    const id = `/abs/path/Foo.tsx:${viewCounter++}:Foo`;
    const view = __dolla_export(id, function OldFoo() {
      return "x";
    }) as any;
    registerViewInstance(view, makeMockNode({ mounted: false }));

    const newView = function NewFoo() {
      return "x";
    } as any;

    const groupSpy = vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    __dolla_apply({ Foo: newView }, { Foo: view });

    const lines = logSpy.mock.calls.map((c) => c[0] as string);
    const exportLine = lines.find((l) => l.includes("Foo"));
    expect(exportLine).toBeDefined();
    expect(exportLine).toMatch(/\/abs\/path\/Foo\.tsx/);
    expect(exportLine).toMatch(/1 instance in \d+\.\d{2}ms — OldFoo → NewFoo/);

    groupSpy.mockRestore();
    logSpy.mockRestore();
  });

  test("logs only the name when old and new names match", () => {
    const id = `/abs/path/Foo.tsx:${viewCounter++}:Foo`;
    const view = __dolla_export(id, function Foo() {
      return "x";
    }) as any;
    registerViewInstance(view, makeMockNode({ mounted: false }));

    const newView = function Foo() {
      return "y";
    } as any;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});

    __dolla_apply({ Foo: newView }, { Foo: view });

    const exportLine = logSpy.mock.calls.map((c) => c[0] as string).find((l) => l.includes("/abs/path/Foo.tsx"))!;
    expect(exportLine).toMatch(/— Foo$/);

    vi.mocked(console.groupCollapsed).mockRestore();
    logSpy.mockRestore();
  });

  test("logs one summary line per export, not one per instance", () => {
    const id = `/abs/path/Foo.tsx:${viewCounter++}:Foo`;
    const view = __dolla_export(id, function Foo() {
      return "x";
    }) as any;
    registerViewInstance(view, makeMockNode({ mounted: false }));
    registerViewInstance(view, makeMockNode({ mounted: false }));

    const newView = function Foo() {
      return "y";
    } as any;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});

    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toMatch(/\/abs\/path\/Foo\.tsx.*: 2 instances in/);

    vi.mocked(console.groupCollapsed).mockRestore();
    logSpy.mockRestore();
  });

  test("skips the whole summary when no instances are replaced", () => {
    const view = makeView("Foo");
    const newView = makeView("Foo");

    const groupSpy = vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(groupSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();

    groupSpy.mockRestore();
    logSpy.mockRestore();
  });
});
