import { describe, expect, test, vi } from "vitest";
import { compose, createAtom, createEffect } from "../../signals.js";
import { flushPendingUpdates } from "../scheduler.js";
import { createContext, onCleanup, onEffect, onMount } from "../../context.js";
import type { View } from "../../index.js";
import { createRef } from "../../ref.js";
import { createMarkup } from "../utils.js";
import { VIEW, ViewNode } from "./view.js";
import { replaceView } from "../../hmr.js";

describe("ViewNode", () => {
  const noopView = vi.fn(function (this: ReturnType<typeof createContext>, _props: {}) {
    return createMarkup("span", { children: "view content" });
  });

  function setup() {
    const context = createContext(null);
    const container = document.createElement("div");
    return { context, container };
  }

  describe("creation and lifecycle", () => {
    test("creates with VIEW symbol on context", () => {
      const { context } = setup();
      const node = new ViewNode(context, noopView, {});
      expect(node.context[VIEW]).toBe(node);
    });

    test("context name matches view name", () => {
      const { context } = setup();
      const namedView = vi.fn(function (this: ReturnType<typeof createContext>) {}) as any;
      Object.defineProperty(namedView, "name", { value: "MyView" });
      const node = new ViewNode(context, namedView, {});
      expect(node.context.name).toBe("MyView");
    });

    test("getRoot returns undefined before mount", () => {
      const { context } = setup();
      const node = new ViewNode(context, noopView, {});
      expect(node.getRoot()).toBeUndefined();
    });

    test("isMounted returns false before mount", () => {
      const { context } = setup();
      const node = new ViewNode(context, noopView, {});
      expect(node.isMounted()).toBe(false);
    });
  });

  describe("mount", () => {
    test("mount calls view function with props", () => {
      const { context, container } = setup();
      const spyView = vi.fn(function (this: ReturnType<typeof createContext>, _props: { msg: string }) {
        return createMarkup("span", { children: _props.msg });
      });
      const node = new ViewNode(context, spyView, { msg: "hello" });
      node.mount(container);
      expect(spyView).toHaveBeenCalledWith({ msg: "hello" }, expect.any(Object));
      expect(container.querySelector("span")!.textContent).toBe("hello");
    });

    test("mount calls view with context as this and second arg", () => {
      const { context, container } = setup();
      let thisContext: any;
      let secondArg: any;
      const spyView = vi.fn(function (this: any, props: any, ctx: any) {
        thisContext = this;
        secondArg = ctx;
        return createMarkup("span", {});
      });
      const node = new ViewNode(context, spyView, {});
      node.mount(container);
      expect(thisContext).toBe(node.context);
      expect(secondArg).toBe(node.context);
    });

    test("mount sets isMounted to true", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      expect(node.isMounted()).toBe(true);
    });

    test("mount renders empty text for null view result", () => {
      const { context, container } = setup();
      const nullView = vi.fn(() => null);
      const node = new ViewNode(context, nullView, {});
      node.mount(container);
      expect(container.firstChild).toBeInstanceOf(Text);
      expect(container.textContent).toBe("");
    });

    test("mount renders empty text for false view result", () => {
      const { context, container } = setup();
      const falseView = vi.fn(() => false) as View;
      const node = new ViewNode(context, falseView, {});
      node.mount(container);
      expect(container.firstChild).toBeInstanceOf(Text);
      expect(container.textContent).toBe("");
    });

    test("mount calls mountContext (triggers onMount hooks)", () => {
      const { context, container } = setup();
      const mountSpy = vi.fn();
      const viewWithHook = vi.fn(function (this: any) {
        onMount(this, mountSpy);
        return null;
      });
      const node = new ViewNode(context, viewWithHook, {});
      node.mount(container);
      expect(mountSpy).toHaveBeenCalledTimes(1);
    });

    test("calling mount while already mounted is a no-op for view function", () => {
      const { context, container } = setup();
      const spyView = vi.fn(() => createMarkup("span", { children: "first" }));
      const node = new ViewNode(context, spyView, {});
      node.mount(container);
      expect(spyView).toHaveBeenCalledTimes(1);
      node.mount(container);
      expect(spyView).toHaveBeenCalledTimes(1); // not called again
    });

    test("second mount does not double-register HMR", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      node.unmount();
      // Re-mount
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("view content");
    });

    test("a view that throws while rendering does not name signals created after it", () => {
      const { context, container } = setup();
      function Broken(): never {
        throw new Error("render failed");
      }
      expect(() => new ViewNode(context, Broken, {}).mount(container)).toThrow("render failed");

      const later = compose(function later() {
        throw new Error("later failed");
      });
      expect(() => later()).toThrow(expect.objectContaining({ message: expect.not.stringContaining("Broken") }));
    });
  });

  describe("unmount", () => {
    test("unmount removes content from DOM", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      expect(container.children.length).toBe(1);
      node.unmount();
      expect(container.children.length).toBe(0);
    });

    test("unmount calls cleanupContext (triggers onCleanup hooks)", () => {
      const { context, container } = setup();
      const cleanupSpy = vi.fn();
      const viewWithCleanup = vi.fn(function (this: any) {
        onCleanup(this, cleanupSpy);
        return null;
      });
      const node = new ViewNode(context, viewWithCleanup, {});
      node.mount(container);
      expect(cleanupSpy).not.toHaveBeenCalled();
      node.unmount();
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });

    test("unmount with skipDOM leaves content in DOM", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      node.unmount(true);
      expect(container.querySelector("span")).not.toBeNull();
    });

    test("unmount resets isMounted to false", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      node.unmount();
      expect(node.isMounted()).toBe(false);
    });
  });

  describe("move", () => {
    test("move moves the rendered content", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, () => createMarkup("span", { children: "view" }), {});
      node.mount(container);
      const sibling = document.createElement("div");
      sibling.textContent = "sibling";
      container.appendChild(sibling);
      expect(container.textContent).toBe("viewsibling");

      node.move(container, sibling);
      expect(container.textContent).toBe("siblingview");
      expect(container.lastChild).toBe(node.getRoot());
    });
  });

  describe("replaceView (HMR)", () => {
    test("replaceView before mount switches view", () => {
      const { context } = setup();
      const view1 = vi.fn(() => createMarkup("span", { children: "v1" }));
      const view2 = vi.fn(() => createMarkup("span", { children: "v2" }));
      const node = new ViewNode(context, view1, {});
      replaceView(node, view2);
      expect(view1).not.toHaveBeenCalled();
      const container = document.createElement("div");
      node.mount(container);
      expect(view2).toHaveBeenCalled();
      expect(container.querySelector("span")!.textContent).toBe("v2");
    });

    test("replaceView after mount re-renders with new view", () => {
      const { context, container } = setup();
      const view1 = vi.fn(() => createMarkup("span", { children: "v1" }));
      const view2 = vi.fn(() => createMarkup("span", { children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("v1");
      replaceView(node, view2);
      expect(container.querySelector("span")!.textContent).toBe("v2");
      expect(view2).toHaveBeenCalledTimes(1);
    });

    test("replaceView preserves position in parent", () => {
      const { context, container } = setup();
      const before = document.createElement("div");
      before.textContent = "before";
      container.appendChild(before);
      const view1 = vi.fn(() => createMarkup("span", { children: "v1" }));
      const view2 = vi.fn(() => createMarkup("span", { children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      const after = document.createElement("div");
      after.textContent = "after";
      container.appendChild(after);
      replaceView(node, view2);
      expect(container.children.length).toBe(3);
      expect(container.children[0].textContent).toBe("before");
      expect(container.children[1].textContent).toBe("v2");
      expect(container.children[2].textContent).toBe("after");
    });

    test("replaceView preserves position when view is the first child", () => {
      const { context, container } = setup();
      const view1 = vi.fn(() => createMarkup("span", { children: "v1" }));
      const view2 = vi.fn(() => createMarkup("span", { children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      const sibling = document.createElement("div");
      sibling.textContent = "sibling";
      container.appendChild(sibling);
      replaceView(node, view2);
      expect(container.children.length).toBe(2);
      expect(container.children[0].textContent).toBe("v2");
      expect(container.children[1].textContent).toBe("sibling");
    });

    test("replaceView triggers cleanup for old view and mount for new view", () => {
      const { context, container } = setup();
      const cleanupSpy = vi.fn();
      const mountSpy = vi.fn();
      const view1 = vi.fn(function (this: any) {
        onCleanup(this, cleanupSpy);
        return createMarkup("span", { children: "v1" });
      });
      const view2 = vi.fn(function (this: any) {
        onMount(this, mountSpy);
        return createMarkup("span", { children: "v2" });
      });
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      expect(cleanupSpy).not.toHaveBeenCalled();
      replaceView(node, view2);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(mountSpy).toHaveBeenCalledTimes(1);
    });

    test("replaceView does not accumulate mount listeners across repeated calls", () => {
      const { context, container } = setup();
      const mountSpy1 = vi.fn();
      const mountSpy2 = vi.fn();
      const view1 = vi.fn(function (this: any) {
        onMount(this, mountSpy1);
        return createMarkup("span", { children: "v1" });
      });
      const view2 = vi.fn(function (this: any) {
        onMount(this, mountSpy2);
        return createMarkup("span", { children: "v2" });
      });
      const node = new ViewNode(context, view1, {});
      node.mount(container);

      // replaceView with view2 — cleanup clears old mount listeners,
      // view2 re-executes and registers mountSpy2
      replaceView(node, view2);

      // Unmount and remount — only mountSpy2 should fire, not mountSpy1
      node.unmount();
      mountSpy1.mockClear();
      mountSpy2.mockClear();
      node.mount(container);
      expect(mountSpy1).not.toHaveBeenCalled();
      expect(mountSpy2).toHaveBeenCalledTimes(1);
    });

    test("replaceView starts the new view's effects", () => {
      const { context, container } = setup();
      const effectSpy = vi.fn();
      const view1 = vi.fn(function (this: any) {
        onEffect(this, effectSpy);
        return createMarkup("span", { children: "v1" });
      });
      const view2 = vi.fn(function (this: any) {
        onEffect(this, effectSpy);
        return createMarkup("span", { children: "v2" });
      });
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      effectSpy.mockClear();

      replaceView(node, view2);
      expect(effectSpy).toHaveBeenCalledTimes(1);
    });

    test("replaceView runs the new view's effects, and its children's, after their elements render", () => {
      const { context, container } = setup();
      const seen: Array<[string, Element | undefined]> = [];

      function Child(_: {}, c: any) {
        const ref = createRef<Element>();
        onEffect(c, () => seen.push(["child", ref()]));
        return createMarkup("span", { ref, children: "child" });
      }
      const view1 = vi.fn(() => createMarkup("div", { children: "v1" }));
      function view2(_: {}, c: any) {
        const ref = createRef<Element>();
        onEffect(c, () => seen.push(["parent", ref()]));
        return createMarkup("div", { ref, children: createMarkup(Child, {}) });
      }

      const node = new ViewNode(context, view1, {});
      node.mount(container);
      replaceView(node, view2 as any);

      expect(seen.map(([name]) => name).sort()).toEqual(["child", "parent"]);
      // As on a first mount, refs are set by the time effects run.
      for (const [name, element] of seen) {
        expect(element, `${name} ref`).toBeInstanceOf(Element);
      }
    });

    test("replaceView leaves exactly one instance in the container (no overlaid duplication)", () => {
      const { context, container } = setup();
      const view1 = vi.fn(() => createMarkup("span", { class: "pg", children: "v1" }));
      const view2 = vi.fn(() => createMarkup("span", { class: "pg", children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      expect(container.querySelectorAll(".pg")).toHaveLength(1);

      replaceView(node, view2);

      const pages = container.querySelectorAll(".pg");
      expect(pages).toHaveLength(1);
      expect(pages[0].textContent).toBe("v2");
      // Ensure the old "v1" text is fully gone (no leftover overlaid copy).
      expect(container.textContent).not.toContain("v1");
    });

    test("replaceView force-removes a leftover old root that unmount failed to detach", () => {
      const { context, container } = setup();
      const view1 = vi.fn(() => createMarkup("div", { class: "pg", children: "v1" }));
      const view2 = vi.fn(() => createMarkup("div", { class: "pg", children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.mount(container);

      // Simulate the failure mode where `unmount()` is unable to detach the
      // old root (e.g. a parent re-render reparented it between snapshot and
      // unmount). We monkey-patch `removeChild` on the container so that the
      // FIRST removal of an element with class "pg" (the initial `unmount`
      // call) is silently swallowed, leaving the old root attached. The
      // defensive guard in `replaceView` runs a second removal for the same
      // node — that one should succeed and clean up the leftover.
      const realRemove = container.removeChild.bind(container);
      let swallowed = 0;
      container.removeChild = ((child: Node) => {
        if ((child as Element).classList?.contains("pg") && swallowed === 0) {
          swallowed++;
          // Simulate "unmount failed to detach": swallow this removal.
          return child;
        }
        return realRemove(child);
      }) as typeof container.removeChild;

      replaceView(node, view2);

      // Restore the real removeChild so the guard's force-remove works.
      container.removeChild = realRemove as typeof container.removeChild;

      // After replaceView (and the guard), there must be exactly one ".pg".
      const pages = container.querySelectorAll(".pg");
      expect(pages).toHaveLength(1);
      expect(pages[0].textContent).toBe("v2");
      expect(container.textContent).not.toContain("v1");
    });

    test("replaceView recovers on next HMR cycle after a failed replacement", () => {
      const { context, container } = setup();
      const view1 = vi.fn(() => createMarkup("span", { class: "pg", children: "v1" }));
      const throwingView = vi.fn(() => {
        throw new Error("boom");
      });
      const view2 = vi.fn(() => createMarkup("span", { class: "pg", children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.mount(container);
      expect(container.querySelectorAll(".pg")).toHaveLength(1);

      // First replacement fails
      expect(() => replaceView(node, throwingView as any)).toThrow("boom");

      // Second replacement with a working view should succeed
      replaceView(node, view2);
      const pages = container.querySelectorAll(".pg");
      expect(pages).toHaveLength(1);
      expect(pages[0].textContent).toBe("v2");
      expect(container.textContent).not.toContain("v1");
    });
  });
  describe("mounted from inside an effect", () => {
    test("keeps updating after the surrounding effect re-runs", () => {
      const { context, container } = setup();
      const [value, setValue] = createAtom("a");
      const [outer, setOuter] = createAtom(0);
      const hookRuns = vi.fn();
      const bodyRuns = vi.fn();

      const View = function (this: ReturnType<typeof createContext>) {
        onEffect(this, () => hookRuns(value()));
        createEffect(() => bodyRuns(value()));
        return createMarkup("span", { title: () => value(), children: () => value() });
      };

      let mounted = false;
      const stop = createEffect(() => {
        outer();
        if (!mounted) {
          mounted = true;
          new ViewNode(context, View, {}).mount(container);
        }
      });

      setOuter(1);
      hookRuns.mockClear();
      bodyRuns.mockClear();

      setValue("b");
      flushPendingUpdates();
      expect(container.innerHTML).toBe('<span title="b">b</span>');
      expect(hookRuns).toHaveBeenCalledWith("b");
      expect(bodyRuns).toHaveBeenCalledWith("b");

      stop();
    });
  });
});

describe("hot reload tracking", () => {
  function Foo() {
    return createMarkup("span", { children: "foo" });
  }
  function Bar() {
    return createMarkup("span", { children: "bar" });
  }

  test("tracks view instances only once the HMR runtime is loaded", async () => {
    vi.resetModules();
    const { ViewNode } = await import("./view.js");
    const { createContext } = await import("../../context.js");

    // Without the HMR runtime, mounting a view does no tracking work.
    const untracked = document.createElement("div");
    new ViewNode(createContext(null), Foo, {}).mount(untracked);

    const hmr = await import("../../hmr.js");
    hmr.__dolla_apply({ Foo: Bar }, { Foo });
    expect(untracked.textContent).toBe("foo");

    // Once loaded (the Vite plugin imports it at the top of every module), views mounted afterwards are tracked.
    const tracked = document.createElement("div");
    new ViewNode(createContext(null), Foo, {}).mount(tracked);
    hmr.__dolla_apply({ Foo: Bar }, { Foo });
    expect(tracked.textContent).toBe("bar");
  });
});
