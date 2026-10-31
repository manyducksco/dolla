import { onCleanup, onEffect } from "../core/context.js";
import { showIf } from "../core/markup/helpers.js";
import { createMarkup } from "../core/markup/utils.js";
import { batch, compose, createAtom, peek, type Getter } from "../core/signals.js";
import type { View } from "../types.js";

export interface VirtualListAPI<T> {
  scrollToBottom: (smooth?: boolean) => void;
  scrollToTop: (smooth?: boolean) => void;
  scrollToIndex: (index: number, options?: { smooth?: boolean; align?: "start" | "center" | "end" }) => void;
  scrollToItem: (item: T, options?: { smooth?: boolean; align?: "start" | "center" | "end" }) => void;
  isAtBottom: Getter<boolean>;
}

export interface VirtualListContext {
  isEntering: Getter<boolean>;
}

export interface VirtualListOptions<T> {
  items: Getter<T[]>;
  /** A stable identifier for each item, crucial for detecting changes accurately */
  keyFn: (item: T) => string | number;
  bottomUp?: boolean;
  enterAnimationMs?: number;

  /** Configuration for the virtual pool */
  estimatedItemHeight?: number;
  poolSize?: number;

  /** Infinite scroll callbacks */
  onTopReached?: () => void;
  onBottomReached?: () => void;
  threshold?: number;

  render: (item: Getter<T>, index: Getter<number>, context: VirtualListContext) => any;
  renderEmpty?: () => any;

  isSticky?: (item: T) => boolean;
  renderSticky?: (item: Getter<T>) => any;
}

export function createVirtualList<T>(props: VirtualListOptions<T>): [View, VirtualListAPI<T>] {
  const POOL_SIZE = props.poolSize ?? 100;
  const threshold = props.threshold ?? 300;

  const engine = createOffsetEngine(props.estimatedItemHeight ?? 50);

  let viewport: HTMLElement | null = null;
  const [isAtBottom, setIsAtBottom] = createAtom(true);
  const commandQueue: (() => void)[] = [];

  let isSmoothScrolling = false;
  let isAutoGliding = false;

  const api: VirtualListAPI<T> = {
    scrollToBottom: (smooth = false) => {
      if (!viewport) return commandQueue.push(() => api.scrollToBottom(smooth));
      if (smooth) isSmoothScrolling = isAutoGliding = true;
      setIsAtBottom(true);
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      if (!smooth) isAutoGliding = false;
    },
    scrollToTop: (smooth = false) => {
      if (!viewport) return commandQueue.push(() => api.scrollToTop(smooth));
      if (smooth) isSmoothScrolling = true;
      isAutoGliding = false;
      setIsAtBottom(false);
      viewport.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    },
    scrollToIndex: (index: number, options = {}) => {
      if (!viewport) return commandQueue.push(() => api.scrollToIndex(index, options));

      setIsAtBottom(false);
      isAutoGliding = false;

      const avg = peek(engine.averageHeight);
      let target = engine.getOffset(index);
      const itemHeight = engine.getItemHeight(index) ?? avg;
      const isTargetSticky = props.isSticky?.(peek(props.items)[index]) ?? false;

      if (options.align === "center") target -= viewport.clientHeight / 2 - itemHeight / 2;
      else if (options.align === "end") target -= viewport.clientHeight - itemHeight;
      else if (props.isSticky && !isTargetSticky) target -= phantomHeight;

      target = Math.max(0, Math.min(target, viewport.scrollHeight - viewport.clientHeight));

      if (options.smooth) isSmoothScrolling = true;
      viewport.scrollTo({ top: target, behavior: options.smooth ? "smooth" : "auto" });
    },
    scrollToItem: (item: T, options = {}) => {
      const index = peek(props.items).indexOf(item);
      if (index !== -1) api.scrollToIndex(index, options);
    },
    isAtBottom,
  };

  const enteringItems = new Set<T>();

  const pool = Array.from({ length: POOL_SIZE }, (_, i) => {
    const [item, setItem] = createAtom<T | null>(null);
    const [index, setIndex] = createAtom(-1);
    const [offset, setOffset] = createAtom(0);
    const [active, setActive] = createAtom(false);
    const [entering, setEntering] = createAtom(false);

    return {
      item,
      setItem,
      index,
      setIndex,
      offset,
      setOffset,
      active,
      setActive,
      entering,
      setEntering,
      node: createMarkup("div", {
        "data-index": index,
        style: {
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          transform: () => `translateY(${offset()}px)`,
          display: () => (active() ? "block" : "none"),
        },
        children: props.render(item as Getter<T>, index, { isEntering: entering }),
      }),
    };
  });

  const [activeStickyItem, setActiveStickyItem] = createAtom<T | null>(null);
  const [stickyPushOffset, setStickyPushOffset] = createAtom(0);
  let phantomHeight = 0;

  // Set while the view is mounted: the item ResizeObserver and the pool slot
  // elements, in pool order.
  let itemObserver: ResizeObserver | null = null;
  let poolElements: Element[] = [];

  // Measured heights by item key; the engine's index-based measurements are
  // rebuilt from this whenever the list changes.
  const heightsByKey = new Map<string | number, number>();

  function remapHeights(items: T[]) {
    const entries: { index: number; height: number }[] = [];
    const liveKeys = new Set<string | number>();
    for (let i = 0; i < items.length; i++) {
      const key = props.keyFn(items[i]);
      liveKeys.add(key);
      const height = heightsByKey.get(key);
      if (height !== undefined) entries.push({ index: i, height });
    }
    for (const key of heightsByKey.keys()) {
      if (!liveKeys.has(key)) heightsByKey.delete(key);
    }
    engine.clearCache();
    engine.updateHeights(entries);
  }

  const stickyIndices = compose(() => {
    if (!props.isSticky) return [];
    return props
      .items()
      .map((item, i) => (props.isSticky!(item) ? i : -1))
      .filter((i) => i !== -1);
  });

  function updateScrollSlice() {
    const currentScroll = viewport ? viewport.scrollTop : 0;
    const data = peek(props.items);
    const total = data.length;

    const startIndex = engine.findIndexAtScroll(currentScroll - peek(engine.averageHeight) * 5, total);

    if (props.isSticky && props.renderSticky) {
      const indices = peek(stickyIndices);
      const { activeIdx, nextIdx } = engine.findSticky(currentScroll, indices);

      const newActive = activeIdx !== -1 ? data[activeIdx] : null;
      if (peek(activeStickyItem) !== newActive) setActiveStickyItem(newActive);

      let push = 0;
      if (nextIdx !== -1 && phantomHeight > 0) {
        const distanceToNext = engine.getOffset(nextIdx) - currentScroll;
        if (distanceToNext < phantomHeight) push = distanceToNext - phantomHeight;
      }
      if (peek(stickyPushOffset) !== push) setStickyPushOffset(push);
    }

    const reused: number[] = [];

    batch(() => {
      for (let i = 0; i < POOL_SIZE; i++) pool[i].setActive(false);
      const endIndex = Math.min(total, startIndex + POOL_SIZE);
      for (let i = startIndex; i < endIndex; i++) {
        const slot = pool[i % POOL_SIZE];
        const currentData = data[i];
        if (peek(slot.index) !== i || peek(slot.item) !== currentData) reused.push(i % POOL_SIZE);
        slot.setItem(currentData);
        slot.setIndex(i);
        slot.setOffset(engine.getOffset(i));
        slot.setActive(true);
        slot.setEntering(enteringItems.has(currentData));
      }
    });

    // A ResizeObserver only reports size *changes*, so a slot that now shows
    // a different item at the same height would never be measured. Observing
    // it again queues a fresh initial observation.
    if (itemObserver) {
      for (const slotIndex of reused) {
        const el = poolElements[slotIndex];
        if (!el) continue;
        itemObserver.unobserve(el);
        itemObserver.observe(el);
      }
    }
  }

  const VirtualListView: View = (_, c) => {
    let hasReachedStart = false;
    let hasReachedEnd = false;

    // Pending frames and timers, cancelled on unmount.
    const frames = new Set<number>();
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function nextFrame(fn: () => void) {
      const id = requestAnimationFrame(() => {
        frames.delete(id);
        fn();
      });
      frames.add(id);
    }

    function checkBoundaries() {
      if (!viewport) return;
      const st = viewport.scrollTop;
      // Evaluate offset math directly to avoid DOM paint delays
      const totalH = engine.getTotalHeight(peek(props.items).length);
      const distToBottom = totalH - st - viewport.clientHeight;

      if (st <= threshold) {
        if (!hasReachedStart) {
          hasReachedStart = true;
          props.onTopReached?.();
        }
      } else hasReachedStart = false;

      if (distToBottom <= threshold) {
        if (!hasReachedEnd) {
          hasReachedEnd = true;
          props.onBottomReached?.();
        }
      } else hasReachedEnd = false;
    }

    const observer = new ResizeObserver((entries) => {
      const currentScroll = viewport ? viewport.scrollTop : 0;
      const totalItems = peek(props.items).length;

      const anchorIndex = engine.findIndexAtScroll(currentScroll, totalItems);
      const oldAnchorOffset = engine.getOffset(anchorIndex);

      const data = peek(props.items);
      const parsedEntries = [];
      for (let i = 0; i < entries.length; i++) {
        const dataIndex = Number((entries[i].target as HTMLElement).dataset.index);
        if (!isNaN(dataIndex) && dataIndex >= 0 && dataIndex < data.length) {
          const height = Math.round(entries[i].borderBoxSize[0].blockSize);
          parsedEntries.push({ index: dataIndex, height });
          if (height > 0) heightsByKey.set(props.keyFn(data[dataIndex]), height);
        }
      }

      if (engine.updateHeights(parsedEntries)) {
        const effectivelyAtBottom = peek(isAtBottom) || isAutoGliding;
        const shift = engine.getOffset(anchorIndex) - oldAnchorOffset;

        if (props.bottomUp && effectivelyAtBottom && viewport) {
          nextFrame(() => {
            if (!viewport) return;
            if (isAutoGliding) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
            else {
              viewport.scrollTop = viewport.scrollHeight;
              setIsAtBottom(true);
            }
          });
        } else if (shift !== 0 && viewport && currentScroll > 0 && !isSmoothScrolling) {
          viewport.scrollTop += shift;
        }
        updateScrollSlice();
        checkBoundaries(); // Re-evaluate if height changes put us in threshold
      }
    });

    onCleanup(c, () => {
      observer.disconnect();
      for (const id of frames) cancelAnimationFrame(id);
      frames.clear();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      // Their timers were cancelled, so nothing would clear these anymore.
      enteringItems.clear();
    });

    let previousCount = peek(props.items).length;
    let previousFirstKey: string | number | null = previousCount > 0 ? props.keyFn(peek(props.items)[0]) : null;

    onEffect(c, () => {
      const currentItems = props.items();
      const currentCount = currentItems.length;
      const currentFirstKey = currentCount > 0 ? props.keyFn(currentItems[0]) : null;

      if (
        currentCount > previousCount &&
        previousFirstKey !== null &&
        props.keyFn(currentItems[currentCount - previousCount]) === previousFirstKey
      ) {
        if (viewport) {
          viewport.scrollTop += (currentCount - previousCount) * peek(engine.averageHeight);
        }
        hasReachedStart = false; // Unlock prepends
      }

      // Measured heights belong to items, not positions. Re-key them to the
      // new indices so prepends, removals and reorders don't leave stale
      // heights (and totals) behind.
      remapHeights(currentItems);

      if (currentCount > previousCount && currentFirstKey === previousFirstKey) {
        hasReachedEnd = false; // Unlock appends
        if (props.enterAnimationMs) {
          for (let i = previousCount; i < currentCount; i++) {
            const newItem = currentItems[i];
            enteringItems.add(newItem);
            const timer = setTimeout(() => {
              timers.delete(timer);
              enteringItems.delete(newItem);
              updateScrollSlice();
            }, props.enterAnimationMs);
            timers.add(timer);
          }
        }

        if (props.bottomUp && (peek(isAtBottom) || isAutoGliding) && viewport) {
          isSmoothScrolling = isAutoGliding = true;
          nextFrame(() => viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" }));
        }
      }

      previousCount = currentCount;
      previousFirstKey = currentFirstKey;

      updateScrollSlice();
      checkBoundaries(); // Re-evaluate immediately after data arrives
    });

    return createMarkup("div", {
      ref: (el: HTMLElement) => {
        viewport = el;
        itemObserver = observer;
        poolElements = Array.from(el.children[el.children.length - 1].children);
        poolElements.forEach((child) => observer.observe(child));

        if (props.bottomUp) {
          el.scrollTop = el.scrollHeight;
          setIsAtBottom(true);
        }

        if (commandQueue.length > 0) {
          commandQueue.forEach((cmd) => cmd());
          commandQueue.length = 0;
        }

        const onScrollEnd = () => {
          isSmoothScrolling = isAutoGliding = false;
        };
        el.addEventListener("scrollend", onScrollEnd);

        let lastSt = el.scrollTop;
        const onScroll = () => {
          const st = el.scrollTop;
          const distToBottom = el.scrollHeight - st - el.clientHeight;
          const isScrollingUp = st < lastSt;

          if (!isSmoothScrolling) {
            if (isScrollingUp && distToBottom > 15) setIsAtBottom(false);
            else if (!isScrollingUp && distToBottom <= 100) setIsAtBottom(true);
          }
          lastSt = st;

          checkBoundaries();
          updateScrollSlice();
        };
        el.addEventListener("scroll", onScroll, { passive: true });

        // Bootstrap on next frame to ensure clientHeight is populated
        nextFrame(() => {
          if (viewport) {
            checkBoundaries();
            updateScrollSlice();
          }
        });

        return () => {
          el.removeEventListener("scrollend", onScrollEnd);
          el.removeEventListener("scroll", onScroll);
          viewport = null;
          if (itemObserver === observer) itemObserver = null;
          poolElements = [];
        };
      },
      style: {
        position: "relative",
        overflowY: "auto",
        overflowX: "hidden",
        height: "100%",
        width: "100%",
        contain: "content",
      },
      children: [
        props.renderEmpty && showIf(() => props.items().length === 0, props.renderEmpty),
        props.renderSticky &&
          createMarkup("div", {
            style: {
              position: "sticky",
              top: "0",
              left: "0",
              width: "100%",
              height: "0px",
              zIndex: "10",
              overflow: "visible",
            },
            children: createMarkup("div", {
              ref: (el: HTMLElement) => {
                const obs = new ResizeObserver((entries) => {
                  phantomHeight = entries[0].borderBoxSize[0].blockSize;
                  updateScrollSlice();
                });
                obs.observe(el);
                return () => obs.disconnect();
              },
              style: {
                transform: () => `translateY(${stickyPushOffset()}px)`,
                display: () => (activeStickyItem() !== null ? "block" : "none"),
              },
              children: props.renderSticky(activeStickyItem as Getter<T>),
            }),
          }),
        createMarkup("div", {
          style: {
            height: () => `${engine.getTotalHeight(props.items().length)}px`,
            width: "100%",
            position: "relative",
          },
          children: pool.map((p) => p.node),
        }),
      ],
    });
  };

  return [VirtualListView, api];
}

export function createOffsetEngine(defaultAssumption: number) {
  const [measuredCount, setMeasuredCount] = createAtom(0);
  const [totalMeasuredHeight, setTotalMeasuredHeight] = createAtom(0);
  const measuredHeights = new Map<number, number>();
  const offsetCache: number[] = [];
  let lastCalculatedIndex = -1;

  const averageHeight = compose(() =>
    measuredCount() > 0 ? Math.round(totalMeasuredHeight() / measuredCount()) : defaultAssumption,
  );

  function getTotalHeight(totalItems: number): number {
    return totalMeasuredHeight() + (totalItems - measuredCount()) * averageHeight();
  }

  // Offsets are cached until heights change, which is also the only time the average changes.
  function getOffset(index: number): number {
    if (index > lastCalculatedIndex) {
      const avg = peek(averageHeight);
      let offset =
        lastCalculatedIndex < 0
          ? 0
          : offsetCache[lastCalculatedIndex] + (measuredHeights.get(lastCalculatedIndex) ?? avg);
      for (let i = lastCalculatedIndex + 1; i <= index; i++) {
        offsetCache[i] = offset;
        offset += measuredHeights.get(i) ?? avg;
      }
      lastCalculatedIndex = index;
    }
    return offsetCache[index] || 0;
  }

  function findIndexAtScroll(scrollPos: number, totalItems: number): number {
    if (totalItems <= 0) return 0;
    let low = 0,
      high = totalItems - 1,
      foundIndex = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (getOffset(mid) < scrollPos) {
        foundIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return foundIndex;
  }

  function findSticky(scrollPos: number, indices: number[]) {
    if (!indices.length) return { activeIdx: -1, nextIdx: -1 };

    let low = 0,
      high = indices.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (getOffset(indices[mid]) <= scrollPos) low = mid + 1;
      else high = mid - 1;
    }

    return {
      activeIdx: low > 0 ? indices[low - 1] : -1,
      nextIdx: low < indices.length ? indices[low] : -1,
    };
  }

  function updateHeights(entries: { index: number; height: number }[]): boolean {
    let needsRecalc = false;
    let currentCount = peek(measuredCount);
    let currentTotal = peek(totalMeasuredHeight);

    for (let i = 0; i < entries.length; i++) {
      const { index, height } = entries[i];
      if (height === 0) continue;

      const oldHeight = measuredHeights.get(index);
      if (oldHeight === undefined) {
        // Record every first measurement, even one that matches the average,
        // so it counts toward the average from now on.
        currentCount++;
        currentTotal += height;
      } else if (oldHeight !== height) {
        currentTotal += height - oldHeight;
      } else {
        continue;
      }
      measuredHeights.set(index, height);
      needsRecalc = true;
    }

    if (needsRecalc) {
      batch(() => {
        setMeasuredCount(currentCount);
        setTotalMeasuredHeight(currentTotal);
      });
      lastCalculatedIndex = -1; // Bust cache
    }

    return needsRecalc;
  }

  function clearCache() {
    offsetCache.length = 0;
    lastCalculatedIndex = -1;
    measuredHeights.clear();
    batch(() => {
      setMeasuredCount(0);
      setTotalMeasuredHeight(0);
    });
  }

  function getItemHeight(index: number) {
    return measuredHeights.get(index);
  }

  return {
    averageHeight,
    getTotalHeight,
    getOffset,
    findIndexAtScroll,
    findSticky,
    updateHeights,
    clearCache,
    getItemHeight,
  };
}
