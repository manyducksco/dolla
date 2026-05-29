import { describe, expect, test, vi } from "vitest";
import { createContext, mountContext, onCleanup, onMount } from "../../context.js";
import { createMarkup } from "../utils.js";
import { ViewNode, VIEW } from "./view.js";
import { View } from "../../index.js";

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
    test("mount renders view content into container", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      expect(container.querySelector("span")!.textContent).toBe("view content");
    });

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
    test("move delegates to child node", () => {
      const { context, container } = setup();
      const node = new ViewNode(context, noopView, {});
      node.mount(container);
      const sibling = document.createElement("div");
      container.appendChild(sibling);
      expect(() => node.move(container, sibling)).not.toThrow();
    });
  });

  describe("replaceView (HMR)", () => {
    test("replaceView before mount switches view", () => {
      const { context } = setup();
      const view1 = vi.fn(() => createMarkup("span", { children: "v1" }));
      const view2 = vi.fn(() => createMarkup("span", { children: "v2" }));
      const node = new ViewNode(context, view1, {});
      node.replaceView(view2);
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
      node.replaceView(view2);
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
      node.replaceView(view2);
      expect(container.children.length).toBe(3);
      expect(container.children[0].textContent).toBe("before");
      expect(container.children[1].textContent).toBe("v2");
      expect(container.children[2].textContent).toBe("after");
    });

    test("replaceView triggers cleanup and mount hooks", () => {
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
      node.replaceView(view2);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
      expect(mountSpy).toHaveBeenCalledTimes(1);
    });
  });
});
