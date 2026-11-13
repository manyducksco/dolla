import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createRoot } from "../core/root.js";
import { flushPendingUpdates } from "../core/markup/scheduler.js";
import { createMarkup } from "../core/markup/utils.js";
import { createAtom, type Getter } from "../core/signals.js";
import { createOffsetEngine, createVirtualList, type VirtualListOptions } from "./index.js";

describe("createOffsetEngine", () => {
  describe("getOffset", () => {
    test("returns 0 for index 0 with no measurements", () => {
      const engine = createOffsetEngine(50);
      expect(engine.getOffset(0)).toBe(0);
    });

    test("returns index * avg with no measurements", () => {
      const engine = createOffsetEngine(50);
      expect(engine.getOffset(3)).toBe(150);
    });

    test("uses measured heights when available", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([
        { index: 0, height: 100 },
        { index: 1, height: 80 },
      ]);
      // item 0 = 100, item 1 = 80
      expect(engine.getOffset(0)).toBe(0);
      expect(engine.getOffset(1)).toBe(100);
      expect(engine.getOffset(2)).toBe(180); // 100 + 80
      expect(engine.getOffset(3)).toBe(270); // 100 + 80 + the measured average, 90
    });

    test("uses avg for unmeasured items between measured ones", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([
        { index: 0, height: 100 },
        { index: 3, height: 200 },
      ]);
      // index 1 and 2 use the measured average, (100 + 200) / 2 = 150
      expect(engine.getOffset(0)).toBe(0);
      expect(engine.getOffset(1)).toBe(100);
      expect(engine.getOffset(2)).toBe(250); // 100 + 150
      expect(engine.getOffset(3)).toBe(400); // 100 + 150 + 150
      expect(engine.getOffset(4)).toBe(600); // 100 + 150 + 150 + 200
    });

    test("is consistent across repeated calls", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 120 }]);
      expect(engine.getOffset(5)).toBe(engine.getOffset(5));
    });
  });

  describe("getTotalHeight", () => {
    test("with no measurements returns totalItems * avg", () => {
      const engine = createOffsetEngine(50);
      expect(engine.getTotalHeight(10)).toBe(500);
    });

    test("uses measured heights for known items", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([
        { index: 0, height: 200 },
        { index: 1, height: 150 },
      ]);
      // measured: 200 + 150 = 350, avg = 175
      // unmeasured: (10 - 2) * 175 = 1400
      expect(engine.getTotalHeight(10)).toBe(1750);
    });
  });

  describe("findIndexAtScroll", () => {
    test("returns 0 for scroll at start", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findIndexAtScroll(0, 10)).toBe(0);
    });

    test("returns 0 for empty list", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findIndexAtScroll(0, 0)).toBe(0);
      expect(engine.findIndexAtScroll(100, 0)).toBe(0);
    });

    test("finds correct index for uniform heights", () => {
      const engine = createOffsetEngine(50);
      // heights: 50, 50, 50, 50, 50
      // scroll 120 → index 2 (offset 100 <= 120 < 150)
      expect(engine.findIndexAtScroll(120, 5)).toBe(2);
    });

    test("returns last index for scroll past end", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findIndexAtScroll(9999, 5)).toBe(4);
    });

    test("works with measured variable heights", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([
        { index: 0, height: 200 },
        { index: 1, height: 30 },
      ]);
      // offsets: 0=0, 1=200, 2=230, 3=280, 4=330
      // findIndexAtScroll uses strict < comparison, so at exact boundaries stays at prev
      expect(engine.findIndexAtScroll(0, 5)).toBe(0);
      expect(engine.findIndexAtScroll(50, 5)).toBe(0);
      expect(engine.findIndexAtScroll(199, 5)).toBe(0);
      expect(engine.findIndexAtScroll(201, 5)).toBe(1);
      expect(engine.findIndexAtScroll(229, 5)).toBe(1);
      expect(engine.findIndexAtScroll(231, 5)).toBe(2);
    });
  });

  describe("findSticky", () => {
    test("returns -1/-1 for empty indices array", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findSticky(0, [])).toEqual({ activeIdx: -1, nextIdx: -1 });
    });

    test("finds active sticky at scroll start", () => {
      const engine = createOffsetEngine(50);
      // indices of sticky items: [2, 5]
      expect(engine.findSticky(0, [2, 5])).toEqual({ activeIdx: -1, nextIdx: 2 });
    });

    test("finds correct sticky when scrolled past it", () => {
      const engine = createOffsetEngine(50);
      // indices of sticky items: [2, 5]
      // offsets: 2 → 100, 5 → 250
      // scroll 150 → past index 2, before index 5
      expect(engine.findSticky(150, [2, 5])).toEqual({ activeIdx: 2, nextIdx: 5 });
    });

    test("finds last sticky when scrolled past all", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findSticky(999, [2, 5])).toEqual({ activeIdx: 5, nextIdx: -1 });
    });

    test("works with measured heights", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 200 }]);
      // The average is now 200, so offsets: 0=0, 1=200, 2=400, 3=600
      // scroll 50 → past index 0 but offsets show it's still at index 0
      expect(engine.findSticky(50, [0, 3])).toEqual({ activeIdx: 0, nextIdx: 3 });
      // scroll 220 → past index 0, at index 1, next sticky is 3
      expect(engine.findSticky(220, [0, 3])).toEqual({ activeIdx: 0, nextIdx: 3 });
      // scroll 600 → at index 3
      expect(engine.findSticky(600, [0, 3])).toEqual({ activeIdx: 3, nextIdx: -1 });
    });
  });

  describe("updateHeights", () => {
    test("returns false for no changes", () => {
      const engine = createOffsetEngine(50);
      expect(engine.updateHeights([])).toBe(false);
    });

    test("returns true when heights change", () => {
      const engine = createOffsetEngine(50);
      expect(engine.updateHeights([{ index: 0, height: 100 }])).toBe(true);
    });

    test("skips zero-height entries", () => {
      const engine = createOffsetEngine(50);
      expect(engine.updateHeights([{ index: 0, height: 0 }])).toBe(false);
    });

    test("records a height equal to the current average", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 50 }]);
      expect(engine.getItemHeight(0)).toBe(50);

      // Item 0 counts toward the average: (50 + 150) / 2 = 100.
      engine.updateHeights([{ index: 1, height: 150 }]);
      expect(engine.averageHeight()).toBe(100);
      expect(engine.getTotalHeight(4)).toBe(400);
    });
  });

  describe("getItemHeight", () => {
    test("returns undefined for unmeasured index", () => {
      const engine = createOffsetEngine(50);
      expect(engine.getItemHeight(0)).toBeUndefined();
    });

    test("returns measured height", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 150 }]);
      expect(engine.getItemHeight(0)).toBe(150);
    });
  });

  describe("clearCache", () => {
    test("resets offset calculations", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 200 }]);
      expect(engine.getOffset(1)).toBe(200);
      engine.clearCache();
      // After clearing, getOffset returns to avg-based calculation
      expect(engine.getOffset(1)).toBe(50);
    });

    test("resets the measured totals used for the average and total height", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([
        { index: 0, height: 200 },
        { index: 1, height: 150 },
      ]);
      engine.clearCache();
      expect(engine.averageHeight()).toBe(50);
      expect(engine.getTotalHeight(10)).toBe(500);
    });
  });
});

/*============================*\
||     createVirtualList      ||
\*============================*/

/**
 * happy-dom has no layout and its ResizeObserver never fires. This mock
 * follows the real delivery rules: `observe()` always queues an initial
 * observation, and later deliveries only include elements whose size changed
 * since they were last reported. Sizes come from `heightOf`.
 */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;
  observed = new Set<Element>();
  lastReported = new Map<Element, number>();
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
    this.lastReported.delete(el);
  }

  unobserve(el: Element) {
    this.observed.delete(el);
    this.lastReported.delete(el);
  }

  disconnect() {
    this.observed.clear();
    this.lastReported.clear();
    this.disconnected = true;
  }

  deliver(heightOf: (el: HTMLElement) => number) {
    const entries: any[] = [];
    for (const el of this.observed) {
      const height = heightOf(el as HTMLElement);
      if (this.lastReported.get(el) === height) continue;
      this.lastReported.set(el, height);
      entries.push({ target: el, borderBoxSize: [{ blockSize: height, inlineSize: 0 }] });
    }
    if (entries.length > 0) this.callback(entries, this as any);
  }

  static deliverAll(heightOf: (el: HTMLElement) => number) {
    for (const instance of MockResizeObserver.instances) {
      if (!instance.disconnected) instance.deliver(heightOf);
    }
  }
}

describe("createVirtualList", () => {
  type Item = { id: number };

  const roots: { unmount(): void }[] = [];

  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    for (const root of roots.splice(0)) root.unmount();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const range = (from: number, to: number): Item[] => {
    const out: Item[] = [];
    for (let i = from; i < to; i++) out.push({ id: i });
    return out;
  };

  /** Heights by item id; hidden pool slots measure 0 like `display: none`. */
  function heightsBy(fn: (id: number) => number, items: Getter<Item[]>) {
    return (el: HTMLElement) => {
      if (el.style.display === "none") return 0;
      const index = Number(el.dataset.index);
      const item = items()[index];
      return item ? fn(item.id) : 0;
    };
  }

  async function setup(options: Partial<VirtualListOptions<Item>> & { items: Getter<Item[]> }) {
    const [View, api] = createVirtualList<Item>({
      keyFn: (item) => item.id,
      render: (item) => createMarkup("span", { children: () => String(item()?.id) }),
      ...options,
    });
    const target = document.createElement("div");
    document.body.append(target);
    const root = createRoot(target);
    roots.push(root);
    await root.mount(View);
    flushPendingUpdates();

    const viewport = target.querySelector("div") as HTMLElement;
    const content = viewport.lastElementChild as HTMLElement;
    const slots = Array.from(content.children) as HTMLElement[];

    const scrollTo = (top: number) => {
      viewport.scrollTop = top;
      viewport.dispatchEvent(new Event("scroll"));
      flushPendingUpdates();
    };

    return { View, api, root, target, viewport, content, slots, scrollTo };
  }

  const slotFor = (slots: HTMLElement[], index: number) =>
    slots.find((el) => el.dataset.index === String(index) && el.style.display !== "none");

  test("forgets heights of removed items when the list shrinks", async () => {
    const [items, setItems] = createAtom(range(0, 10));
    const { content } = await setup({ items, poolSize: 20 });

    MockResizeObserver.deliverAll(heightsBy((id) => (id < 3 ? 10 : 100), items));
    flushPendingUpdates();
    expect(content.style.height).toBe("730px");

    setItems(range(0, 3));
    flushPendingUpdates();
    expect(content.style.height).toBe("30px");
  });

  test("measures a recycled pool slot even when its height is unchanged", async () => {
    // Slot 0 shows items 0 then 8 (both 40px); slot 1 shows items 1 then 7
    // (both 120px). The ResizeObserver never reports a size change for them.
    const heights: Record<number, number> = { 0: 40, 1: 120, 7: 120, 8: 40 };
    const [items] = createAtom(range(0, 20));
    const { slots, scrollTo } = await setup({ items, poolSize: 2 });
    const heightOf = heightsBy((id) => heights[id] ?? 100, items);

    MockResizeObserver.deliverAll(heightOf);
    flushPendingUpdates();

    // Average is 80 after measuring items 0 and 1, so this renders items 7-8.
    scrollTo(1000);
    expect(slotFor(slots, 7)).toBeDefined();
    expect(slotFor(slots, 8)).toBeDefined();

    MockResizeObserver.deliverAll(heightOf);
    flushPendingUpdates();

    // With item 7 measured at 120px: 40 + 120 + 5 * 80 + 120 = 680.
    expect(slotFor(slots, 8)!.style.transform).toBe("translateY(680px)");
  });

  test("disconnects its ResizeObserver on unmount", async () => {
    const [items] = createAtom(range(0, 5));
    const { root } = await setup({ items });
    expect(MockResizeObserver.instances.length).toBeGreaterThan(0);

    root.unmount();
    for (const instance of MockResizeObserver.instances) {
      expect(instance.disconnected).toBe(true);
    }
  });

  test("leaves a single live ResizeObserver after a remount", async () => {
    const [items] = createAtom(range(0, 5));
    const { View, root } = await setup({ items, poolSize: 5 });
    root.unmount();

    const target = document.createElement("div");
    document.body.append(target);
    const second = createRoot(target);
    roots.push(second);
    await second.mount(View);

    const live = MockResizeObserver.instances.filter((o) => !o.disconnected);
    expect(live.length).toBe(1);
  });

  test("removes its scroll listeners on unmount", async () => {
    const listeners = new Map<EventTarget, Set<string>>();
    const proto = HTMLElement.prototype;
    const originalAdd = proto.addEventListener;
    const originalRemove = proto.removeEventListener;
    const keyOf = (type: string, fn: unknown) => `${type}:${String(fn)}`;
    const fnIds = new Map<unknown, number>();
    const idOf = (fn: unknown) => {
      if (!fnIds.has(fn)) fnIds.set(fn, fnIds.size);
      return fnIds.get(fn);
    };

    proto.addEventListener = function (this: EventTarget, type: string, fn: any, options?: any) {
      if (!listeners.has(this)) listeners.set(this, new Set());
      listeners.get(this)!.add(keyOf(type, idOf(fn)));
      return originalAdd.call(this, type, fn, options);
    };
    proto.removeEventListener = function (this: EventTarget, type: string, fn: any, options?: any) {
      listeners.get(this)?.delete(keyOf(type, idOf(fn)));
      return originalRemove.call(this, type, fn, options);
    };

    try {
      const [items] = createAtom(range(0, 5));
      const { root, viewport } = await setup({ items });
      const scrollListeners = () => [...(listeners.get(viewport) ?? [])].filter((key) => key.startsWith("scroll"));
      expect(scrollListeners().length).toBeGreaterThan(0);

      root.unmount();
      expect(scrollListeners()).toEqual([]);
    } finally {
      proto.addEventListener = originalAdd;
      proto.removeEventListener = originalRemove;
    }
  });

  test("cancels pending frames and enter-animation timers on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
    const [items, setItems] = createAtom(range(0, 3));
    const { root } = await setup({ items, enterAnimationMs: 300, bottomUp: true });

    setItems(range(0, 5));
    flushPendingUpdates();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    root.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("detects a prepend when the previous first key is 0", async () => {
    const [items, setItems] = createAtom(range(0, 3));
    const { viewport, scrollTo } = await setup({ items });
    scrollTo(100);
    expect(viewport.scrollTop).toBe(100);

    // Two items prepended in front of key 0: keep the same content in view.
    setItems(range(-2, 3));
    flushPendingUpdates();
    expect(viewport.scrollTop).toBe(200);
  });

  test("keeps measured heights when items are appended or only their data changes", async () => {
    const [items, setItems] = createAtom(range(0, 4));
    const { content, slots } = await setup({ items, poolSize: 10 });

    MockResizeObserver.deliverAll(heightsBy((id) => (id === 0 ? 200 : 20), items));
    flushPendingUpdates();
    expect(content.style.height).toBe("260px");

    // Two unmeasured items are added at the measured average, 65px.
    setItems(range(0, 6));
    flushPendingUpdates();
    expect(content.style.height).toBe("390px");
    expect(slotFor(slots, 4)!.style.transform).toBe("translateY(260px)");
    expect(slotFor(slots, 5)!.style.transform).toBe("translateY(325px)");

    // New objects with the same keys in the same places.
    setItems(range(0, 6));
    flushPendingUpdates();
    expect(content.style.height).toBe("390px");
    expect(slotFor(slots, 1)!.style.transform).toBe("translateY(200px)");
  });

  test("moves heights when an item is replaced without the length changing", async () => {
    const [items, setItems] = createAtom(range(0, 4));
    const { content, slots } = await setup({ items, poolSize: 10 });

    MockResizeObserver.deliverAll(heightsBy((id) => (id === 0 ? 200 : 20), items));
    flushPendingUpdates();

    // Item 0 (200px) is replaced by an unmeasured item; the rest keep 20px each.
    setItems([{ id: 9 }, ...range(1, 4)]);
    flushPendingUpdates();
    expect(content.style.height).toBe("80px");
    expect(slotFor(slots, 1)!.style.transform).toBe("translateY(20px)");
  });

  test("keeps heights with their items when the list is reordered", async () => {
    const [items, setItems] = createAtom(range(0, 4));
    const { slots } = await setup({ items, poolSize: 10 });

    MockResizeObserver.deliverAll(heightsBy((id) => (id === 0 ? 200 : 20), items));
    flushPendingUpdates();

    // Move item 0 (200px) to the end: item 3 now sits at 3 * 20px.
    setItems([...range(1, 4), { id: 0 }]);
    flushPendingUpdates();
    expect(slotFor(slots, 3)!.style.transform).toBe("translateY(60px)");
  });
});
