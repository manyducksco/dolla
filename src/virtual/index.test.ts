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
      expect(engine.getOffset(0, 50)).toBe(0);
    });

    test("returns index * avg with no measurements", () => {
      const engine = createOffsetEngine(50);
      expect(engine.getOffset(3, 50)).toBe(150);
    });

    test("uses measured heights when available", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights(
        [
          { index: 0, height: 100 },
          { index: 1, height: 80 },
        ],
        50,
      );
      // item 0 = 100, item 1 = 80
      expect(engine.getOffset(0, 50)).toBe(0);
      expect(engine.getOffset(1, 50)).toBe(100);
      expect(engine.getOffset(2, 50)).toBe(180); // 100 + 80 + avg(50) for unmeasured
    });

    test("uses avg for unmeasured items between measured ones", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights(
        [
          { index: 0, height: 100 },
          { index: 3, height: 200 },
        ],
        50,
      );
      // index 1 and 2 use avg(50)
      expect(engine.getOffset(0, 50)).toBe(0);
      expect(engine.getOffset(1, 50)).toBe(100);
      expect(engine.getOffset(2, 50)).toBe(150); // 100 + 50
      expect(engine.getOffset(3, 50)).toBe(200); // 100 + 50 + 50
      expect(engine.getOffset(4, 50)).toBe(400); // 100 + 50 + 50 + 200
    });

    test("is consistent across repeated calls", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 120 }], 50);
      expect(engine.getOffset(5, 50)).toBe(engine.getOffset(5, 50));
    });
  });

  describe("getTotalHeight", () => {
    test("with no measurements returns totalItems * avg", () => {
      const engine = createOffsetEngine(50);
      expect(engine.getTotalHeight(10)).toBe(500);
    });

    test("uses measured heights for known items", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights(
        [
          { index: 0, height: 200 },
          { index: 1, height: 150 },
        ],
        50,
      );
      // measured: 200 + 150 = 350, avg = 175
      // unmeasured: (10 - 2) * 175 = 1400
      expect(engine.getTotalHeight(10)).toBe(1750);
    });
  });

  describe("findIndexAtScroll", () => {
    test("returns 0 for scroll at start", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findIndexAtScroll(0, 10, 50)).toBe(0);
    });

    test("returns 0 for empty list", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findIndexAtScroll(0, 0, 50)).toBe(0);
      expect(engine.findIndexAtScroll(100, 0, 50)).toBe(0);
    });

    test("finds correct index for uniform heights", () => {
      const engine = createOffsetEngine(50);
      // heights: 50, 50, 50, 50, 50
      // scroll 120 → index 2 (offset 100 <= 120 < 150)
      expect(engine.findIndexAtScroll(120, 5, 50)).toBe(2);
    });

    test("returns last index for scroll past end", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findIndexAtScroll(9999, 5, 50)).toBe(4);
    });

    test("works with measured variable heights", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights(
        [
          { index: 0, height: 200 },
          { index: 1, height: 30 },
        ],
        50,
      );
      // offsets: 0=0, 1=200, 2=230, 3=280, 4=330
      // findIndexAtScroll uses strict < comparison, so at exact boundaries stays at prev
      expect(engine.findIndexAtScroll(0, 5, 50)).toBe(0);
      expect(engine.findIndexAtScroll(50, 5, 50)).toBe(0);
      expect(engine.findIndexAtScroll(199, 5, 50)).toBe(0);
      expect(engine.findIndexAtScroll(201, 5, 50)).toBe(1);
      expect(engine.findIndexAtScroll(229, 5, 50)).toBe(1);
      expect(engine.findIndexAtScroll(231, 5, 50)).toBe(2);
    });
  });

  describe("findSticky", () => {
    test("returns -1/-1 for empty indices array", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findSticky(0, [], 50)).toEqual({ activeIdx: -1, nextIdx: -1 });
    });

    test("finds active sticky at scroll start", () => {
      const engine = createOffsetEngine(50);
      // indices of sticky items: [2, 5]
      expect(engine.findSticky(0, [2, 5], 50)).toEqual({ activeIdx: -1, nextIdx: 2 });
    });

    test("finds correct sticky when scrolled past it", () => {
      const engine = createOffsetEngine(50);
      // indices of sticky items: [2, 5]
      // offsets: 2 → 100, 5 → 250
      // scroll 150 → past index 2, before index 5
      expect(engine.findSticky(150, [2, 5], 50)).toEqual({ activeIdx: 2, nextIdx: 5 });
    });

    test("finds last sticky when scrolled past all", () => {
      const engine = createOffsetEngine(50);
      expect(engine.findSticky(999, [2, 5], 50)).toEqual({ activeIdx: 5, nextIdx: -1 });
    });

    test("works with measured heights", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 200 }], 50);
      // offsets: 0=0, 1=200, 2=250, 3=300
      // scroll 50 → past index 0 but offsets show it's still at index 0
      expect(engine.findSticky(50, [0, 3], 50)).toEqual({ activeIdx: 0, nextIdx: 3 });
      // scroll 220 → past index 0, at index 1, next sticky is 3
      expect(engine.findSticky(220, [0, 3], 50)).toEqual({ activeIdx: 0, nextIdx: 3 });
      // scroll 300 → at index 3
      expect(engine.findSticky(300, [0, 3], 50)).toEqual({ activeIdx: 3, nextIdx: -1 });
    });
  });

  describe("updateHeights", () => {
    test("returns false for no changes", () => {
      const engine = createOffsetEngine(50);
      expect(engine.updateHeights([], 50)).toBe(false);
    });

    test("returns true when heights change", () => {
      const engine = createOffsetEngine(50);
      expect(engine.updateHeights([{ index: 0, height: 100 }], 50)).toBe(true);
    });

    test("skips zero-height entries", () => {
      const engine = createOffsetEngine(50);
      expect(engine.updateHeights([{ index: 0, height: 0 }], 50)).toBe(false);
    });

    test("records a height equal to the current average", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 50 }], 50);
      expect(engine.getItemHeight(0)).toBe(50);

      // Item 0 counts toward the average: (50 + 150) / 2 = 100.
      engine.updateHeights([{ index: 1, height: 150 }], 50);
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
      engine.updateHeights([{ index: 0, height: 150 }], 50);
      expect(engine.getItemHeight(0)).toBe(150);
    });
  });

  describe("clearCache", () => {
    test("resets offset calculations", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights([{ index: 0, height: 200 }], 50);
      expect(engine.getOffset(1, 50)).toBe(200);
      engine.clearCache();
      // After clearing, getOffset returns to avg-based calculation
      expect(engine.getOffset(1, 50)).toBe(50);
    });

    test("resets the measured totals used for the average and total height", () => {
      const engine = createOffsetEngine(50);
      engine.updateHeights(
        [
          { index: 0, height: 200 },
          { index: 1, height: 150 },
        ],
        50,
      );
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
