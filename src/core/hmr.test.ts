import { describe, expect, test, vi } from "vitest";
import { __dolla_apply, __dolla_export, registerViewInstance, unregisterViewInstance } from "./hmr.js";

function makeView(name: string) {
  return __dolla_export(`test.tsx:${name}`, function () {
    return name;
  }) as any;
}

function makeMockNode() {
  const calls: string[] = [];
  return {
    calls,
    replaceView(newView: any) {
      calls.push(newView());
    },
  };
}

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
    __dolla_apply(
      { Foo: newView, Constant: 42, Method: method },
      { Foo: view, Constant: 42, Method: method } as any,
    );

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
});
