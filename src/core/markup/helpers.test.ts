import { describe, expect, test, vi } from "vitest";
import { createContext } from "../context.js";
import { createAtom } from "../signals.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { PortalNode } from "./nodes/portal.js";
import { RepeatNode } from "./nodes/repeat.js";
import { createMarkup, render } from "./utils.js";
import { createPortal, forEach, hideIf, showIf, showUnless } from "./helpers.js";

function setup() {
  const context = createContext(null);
  const container = document.createElement("div");
  return { context, container };
}

describe("forEach", () => {
  test("static items returns an array of rendered content", () => {
    const result = forEach([1, 2, 3], (item: number) => String(item), (item, index) => `${item()}:${index()}`);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["1:0", "2:1", "3:2"]);
  });

  test("static empty array returns empty array", () => {
    const result = forEach([], (item: number) => String(item), (item, index) => `${item()}:${index()}`);
    expect(result).toEqual([]);
  });

  test("reactive items returns markup with RepeatNode", () => {
    const [items] = createAtom([1, 2]);
    const result = forEach(items, (item: number) => String(item), (item, index) =>
      createMarkup("span", { children: () => `${item()}:${index()}` }),
    );
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");
    const markup = result as ReturnType<typeof createMarkup>;
    expect(markup.type).toBe(RepeatNode);
  });

  test("reactive items renders in DOM", () => {
    const { context, container } = setup();
    const [items] = createAtom([10, 20]);
    const content = forEach(items, (item: number) => String(item), (item, index) =>
      createMarkup("span", { children: () => `${item()}:${index()}` }),
    );
    const node = render(content, context);
    node.mount(container);
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe("10:0");
    expect(spans[1].textContent).toBe("20:1");
  });

  test("reactive items updates reactively", () => {
    const { context, container } = setup();
    const [items, setItems] = createAtom([1]);
    const content = forEach(items, (item: number) => String(item), (item, index) =>
      createMarkup("span", { children: () => `${item()}:${index()}` }),
    );
    const node = render(content, context);
    node.mount(container);
    expect(container.querySelectorAll("span").length).toBe(1);
    setItems([1, 2]);
    expect(container.querySelectorAll("span").length).toBe(2);
  });
});

describe("showIf / hideIf / showUnless / hideUnless", () => {
  describe("showIf", () => {
    test("static truthy returns content", () => {
      expect(showIf(true, "shown")).toBe("shown");
    });

    test("static falsy returns undefined (no fallback)", () => {
      expect(showIf(false, "hidden")).toBeUndefined();
    });

    test("static falsy with fallback returns fallback", () => {
      expect(showIf(false, "hidden", "fallback")).toBe("fallback");
    });

    test("reactive truthy renders content", () => {
      const { context, container } = setup();
      const [cond] = createAtom(true);
      const content = showIf(cond, "rendered");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("rendered");
    });

    test("reactive falsy renders nothing", () => {
      const { context, container } = setup();
      const [cond] = createAtom(false);
      const content = showIf(cond, "hidden");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("");
    });

    test("reactive falsy with fallback renders fallback", () => {
      const { context, container } = setup();
      const [cond] = createAtom(false);
      const content = showIf(cond, "hidden", "fallback");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("fallback");
    });

    test("reactive condition switching truthy → falsy", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(true);
      const content = showIf(cond, "now you see me", "now you don't");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("now you see me");
      setCond(false);
      expect(container.textContent).toBe("now you don't");
    });

    test("reactive condition switching falsy → truthy", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(false);
      const content = showIf(cond, "appears", "disappears");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("disappears");
      setCond(true);
      expect(container.textContent).toBe("appears");
    });
  });

  describe("hideIf", () => {
    test("static truthy returns fallback (inverted)", () => {
      expect(hideIf(true, "hidden", "shown")).toBe("shown");
    });

    test("static falsy returns content (inverted)", () => {
      expect(hideIf(false, "shown", "hidden")).toBe("shown");
    });

    test("reactive truthy shows fallback, falsy shows content", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(true);
      const content = hideIf(cond, "content", "fallback");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("fallback");
      setCond(false);
      expect(container.textContent).toBe("content");
    });
  });

  describe("showUnless", () => {
    test("static truthy returns fallback (inverted)", () => {
      expect(showUnless(true, "shown", "fallback")).toBe("fallback");
    });

    test("static falsy returns content (inverted)", () => {
      expect(showUnless(false, "shown", "fallback")).toBe("shown");
    });

    test("reactive truthy shows fallback, falsy shows content", () => {
      const { context, container } = setup();
      const [cond, setCond] = createAtom(true);
      const content = showUnless(cond, "content", "fallback");
      const node = render(content, context);
      node.mount(container);
      expect(container.textContent).toBe("fallback");
      setCond(false);
      expect(container.textContent).toBe("content");
    });
  });
});

describe("createPortal", () => {
  test("returns markup with PortalNode", () => {
    const target = document.createElement("div");
    const result = createPortal(target, "hello");
    expect(result).toBeDefined();
    const markup = result as ReturnType<typeof createMarkup>;
    expect(markup.type).toBe(PortalNode);
  });

  test("portal renders content in target element", () => {
    const { context, container } = setup();
    const target = document.createElement("div");
    const content = createPortal(target, "portal content");
    const node = render(content, context);
    node.mount(container);
    expect(target.textContent).toBe("portal content");
  });
});
