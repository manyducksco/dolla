import { describe, expect, test, vi } from "vitest";
import { addStore, cleanupContext, createContext, getStore, mountContext } from "./context.js";
import {
  __dolla_apply,
  __dolla_css,
  __dolla_export,
  __dolla_store,
  registerViewInstance,
  unregisterViewInstance,
} from "./hmr.js";
import { css, isCSSTemplate } from "./markup/css.js";
import { ViewNode } from "./markup/nodes/view.js";
import { flushPendingUpdates } from "./markup/scheduler.js";
import { createAtom } from "./signals.js";

let viewCounter = 0;
function makeView(name: string) {
  return __dolla_export(`/test/${viewCounter++}.tsx:${name}`, function () {
    return name;
  }) as any;
}

/**
 * A real `ViewNode` for `view`. Mounting registers it with the HMR runtime; an
 * unmounted node is registered by hand, as the Vite plugin's wrapper would.
 */
function makeNode(view: any, opts: { mounted?: boolean; props?: any } = {}) {
  const node = new ViewNode(createContext(null), view, opts.props ?? {});
  const container = document.createElement("div");
  if (opts.mounted ?? true) node.mount(container);
  else registerViewInstance(view, node);
  return { node, container };
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
    const live = __dolla_export(
      id,
      __dolla_store(id, () => ({ version: 1 })),
    ) as any;
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
    const nodes = [makeNode(view), makeNode(view), makeNode(view)];
    expect(nodes.map((n) => n.container.textContent)).toEqual(["Foo", "Foo", "Foo"]);

    const newView = makeView("Bar");
    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(nodes.map((n) => n.container.textContent)).toEqual(["Bar", "Bar", "Bar"]);
  });

  test("survives a replaceView that throws", () => {
    const view = makeView("Foo");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // The new view throws for `a` only, so replacing `a` fails and `b` must still be replaced.
    const a = makeNode(view, { props: { fail: true } });
    const b = makeNode(view);
    const newView = __dolla_export(`/test/${viewCounter++}.tsx:Foo`, function (props: any) {
      if (props.fail) throw new Error("boom");
      return "Bar";
    }) as any;
    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(a.container.textContent).toBe("");
    expect(b.container.textContent).toBe("Bar");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("handles repeated keys without double-replacing the same instance", () => {
    const view = makeView("Foo");
    const a = makeNode(view);

    let renders = 0;
    const newView = __dolla_export(`/test/${viewCounter++}.tsx:Foo`, function () {
      renders++;
      return "Bar";
    }) as any;
    // Simulate a file that has both `Foo` and `default: Foo` in the HMR callback.
    __dolla_apply({ Foo: newView, "default: Foo": newView }, { Foo: view, "default: Foo": view });

    expect(a.container.textContent).toBe("Bar");
    expect(renders).toBe(1);
  });

  test("skips non-function exports", () => {
    const view = makeView("Foo");
    const a = makeNode(view);

    const newView = makeView("Bar");
    const method: any = () => "x";
    // Should not throw even with a non-function export mixed in.
    __dolla_apply({ Foo: newView, Constant: 42, Method: method }, { Foo: view, Constant: 42, Method: method } as any);

    expect(a.container.textContent).toBe("Bar");
  });

  test("unregisterViewInstance removes the node from the active set", () => {
    const view = makeView("Foo");
    const a = makeNode(view);
    const b = makeNode(view);

    unregisterViewInstance(view, a.node);

    const newView = makeView("Bar");
    __dolla_apply({ Foo: newView }, { Foo: view });

    expect(a.container.textContent).toBe("Foo");
    expect(b.container.textContent).toBe("Bar");
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
    makeNode(view);
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
    makeNode(view, { mounted: false });

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
    makeNode(view, { mounted: false });

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
    makeNode(view, { mounted: false });
    makeNode(view, { mounted: false });

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

describe("HMR __dolla_css", () => {
  let cssCounter = 0;
  const nextId = () => `/test/${cssCounter++}.tsx:styles`;

  function plainSheet() {
    const sheets = document.adoptedStyleSheets;
    return sheets[sheets.length - 1];
  }

  /** Rule texts in the plain `css` stylesheet that mention `className`, in sheet order. */
  function rulesFor(className: string): string[] {
    return Array.from(plainSheet().cssRules)
      .map((r) => r.cssText.replace(/\s+/g, " "))
      .filter((text) => text.includes(className));
  }

  function attached(tpl: any) {
    const ctx = createContext(null);
    mountContext(ctx);
    const el = document.createElement("div");
    tpl.attach(ctx, el);
    return { ctx, el };
  }

  test("returns the same template with the same class name when its module reloads", () => {
    const id = nextId();
    const first = __dolla_css(id)`color: red;`;
    const second = __dolla_css(id)`color: blue;`;

    expect(second).toBe(first);
    expect(isCSSTemplate(first)).toBe(true);
    expect(`${first}`).toBe(first.className);
  });

  test("does not share a class with an identical template", () => {
    const hot = __dolla_css(nextId())`text-align: justify;`;
    const plain = css`
      text-align: justify;
    `;
    expect(hot.className).not.toBe(plain.className);
  });

  test("replaces the rule of an attached template in place", () => {
    const id = nextId();
    const tpl = __dolla_css(id)`color: red;`;
    const { el } = attached(tpl);
    // A later template whose rule must keep coming after the hot one in the cascade.
    const later = css`
      outline-color: ${"#" + cssCounter};
    `;
    attached(later);

    __dolla_css(id)`color: blue;`;

    expect(rulesFor(tpl.className)).toEqual([expect.stringContaining("color: blue")]);
    const texts = Array.from(plainSheet().cssRules).map((r) => r.cssText);
    const hotIndex = texts.findIndex((t) => t.includes(tpl.className));
    const laterIndex = texts.findIndex((t) => t.includes(later.className));
    expect(hotIndex).toBeLessThan(laterIndex);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });

  test("replaces extracted at-rules along with the class rule", () => {
    const id = nextId();
    const name = `hot-spin-${cssCounter}`;
    const tpl = __dolla_css(id)`
      @keyframes ${name} { from { opacity: 0; } to { opacity: 1; } }
      animation: ${name} 1s;
    `;
    attached(tpl);

    __dolla_css(id)`color: green;`;

    const texts = Array.from(plainSheet().cssRules).map((r) => r.cssText);
    expect(texts.some((t) => t.includes(name))).toBe(false);
    expect(rulesFor(tpl.className)).toEqual([expect.stringContaining("color: green")]);
  });

  test("does not insert a rule when updated before it is attached", () => {
    const id = nextId();
    const tpl = __dolla_css(id)`color: red;`;
    __dolla_css(id)`color: blue;`;
    expect(rulesFor(tpl.className)).toEqual([]);

    attached(tpl);
    expect(rulesFor(tpl.className)).toEqual([expect.stringContaining("color: blue")]);
  });

  test("rebinds reactive values on attached elements", () => {
    const id = nextId();
    const [color, setColor] = createAtom("red");
    const [size] = createAtom("10px");
    const tpl = __dolla_css(id)`color: ${color};`;
    const { el } = attached(tpl);
    expect(el.style.getPropertyValue(`--${tpl.className}-0`)).toBe("red");

    __dolla_css(id)`margin: ${"0"}; font-size: ${size};`;
    expect(el.style.getPropertyValue(`--${tpl.className}-0`)).toBe("");
    expect(el.style.getPropertyValue(`--${tpl.className}-1`)).toBe("10px");

    // The old binding is gone.
    setColor("blue");
    flushPendingUpdates();
    expect(el.style.getPropertyValue(`--${tpl.className}-0`)).toBe("");
  });

  test("leaves elements alone after their context is cleaned up", () => {
    const id = nextId();
    const [color] = createAtom("red");
    const tpl = __dolla_css(id)`color: red;`;
    const { ctx, el } = attached(tpl);
    cleanupContext(ctx);

    __dolla_css(id)`color: ${color};`;
    expect(el.style.getPropertyValue(`--${tpl.className}-0`)).toBe("");
  });
});
