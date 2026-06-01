import { describe, expect, test } from "vitest";
import { createOffsetEngine } from "./index.js";

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
  });
});
