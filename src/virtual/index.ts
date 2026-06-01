import { onEffect } from "../core/context.js";
import { showIf } from "../core/markup/helpers.js";
import { createMarkup } from "../core/markup/utils.js";
import { batch, compose, createAtom, peek, type Getter } from "../core/signals.js";
import { View } from "../types.js";

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
  const [scrollTop, setScrollTop] = createAtom(0);
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
      if (!smooth) {
        setScrollTop(viewport.scrollTop);
        isAutoGliding = false;
      }
    },
    scrollToTop: (smooth = false) => {
      if (!viewport) return commandQueue.push(() => api.scrollToTop(smooth));
      if (smooth) isSmoothScrolling = true;
      isAutoGliding = false;
      setIsAtBottom(false);
      viewport.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      if (!smooth) setScrollTop(0);
    },
    scrollToIndex: (index: number, options = {}) => {
      if (!viewport) return commandQueue.push(() => api.scrollToIndex(index, options));

      setIsAtBottom(false);
      isAutoGliding = false;

      const avg = peek(engine.averageHeight);
      let target = engine.getOffset(index, avg);
      const itemHeight = engine.getItemHeight(index) ?? avg;
      const isTargetSticky = props.isSticky?.(peek(props.items)[index]) ?? false;

      if (options.align === "center") target -= viewport.clientHeight / 2 - itemHeight / 2;
      else if (options.align === "end") target -= viewport.clientHeight - itemHeight;
      else if (props.isSticky && !isTargetSticky) target -= phantomHeight;

      target = Math.max(0, Math.min(target, viewport.scrollHeight - viewport.clientHeight));

      if (options.smooth) isSmoothScrolling = true;
      viewport.scrollTo({ top: target, behavior: options.smooth ? "smooth" : "auto" });
      if (!options.smooth) setScrollTop(target);
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

  const stickyIndices = compose(() => {
    if (!props.isSticky) return [];
    return props
      .items()
      .map((item, i) => (props.isSticky!(item) ? i : -1))
      .filter((i) => i !== -1);
  });

  function updateScrollSlice() {
    const currentScroll = viewport ? viewport.scrollTop : 0;
    const currentAvg = peek(engine.averageHeight);
    const data = peek(props.items);
    const total = data.length;

    const startIndex = engine.findIndexAtScroll(currentScroll - currentAvg * 5, total, currentAvg);

    if (props.isSticky && props.renderSticky) {
      const indices = peek(stickyIndices);
      const { activeIdx, nextIdx } = engine.findSticky(currentScroll, indices, currentAvg);

      const newActive = activeIdx !== -1 ? data[activeIdx] : null;
      if (peek(activeStickyItem) !== newActive) setActiveStickyItem(newActive);

      let push = 0;
      if (nextIdx !== -1 && phantomHeight > 0) {
        const distanceToNext = engine.getOffset(nextIdx, currentAvg) - currentScroll;
        if (distanceToNext < phantomHeight) push = distanceToNext - phantomHeight;
      }
      if (peek(stickyPushOffset) !== push) setStickyPushOffset(push);
    }

    batch(() => {
      for (let i = 0; i < POOL_SIZE; i++) pool[i].setActive(false);
      const endIndex = Math.min(total, startIndex + POOL_SIZE);
      for (let i = startIndex; i < endIndex; i++) {
        const slot = pool[i % POOL_SIZE];
        const currentData = data[i];
        slot.setItem(currentData);
        slot.setIndex(i);
        slot.setOffset(engine.getOffset(i, currentAvg));
        slot.setActive(true);
        slot.setEntering(enteringItems.has(currentData));
      }
    });
  }

  const VirtualListView: View = (_, c) => {
    let hasReachedStart = false;
    let hasReachedEnd = false;

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
      const oldAvg = peek(engine.averageHeight);
      const totalItems = peek(props.items).length;

      const anchorIndex = engine.findIndexAtScroll(currentScroll, totalItems, oldAvg);
      const oldAnchorOffset = engine.getOffset(anchorIndex, oldAvg);

      const parsedEntries = [];
      for (let i = 0; i < entries.length; i++) {
        const dataIndex = Number((entries[i].target as HTMLElement).dataset.index);
        if (!isNaN(dataIndex)) {
          parsedEntries.push({ index: dataIndex, height: Math.round(entries[i].borderBoxSize[0].blockSize) });
        }
      }

      if (engine.updateHeights(parsedEntries, oldAvg)) {
        const effectivelyAtBottom = peek(isAtBottom) || isAutoGliding;
        const shift = engine.getOffset(anchorIndex, peek(engine.averageHeight)) - oldAnchorOffset;

        if (props.bottomUp && effectivelyAtBottom && viewport) {
          requestAnimationFrame(() => {
            if (!viewport) return;
            if (isAutoGliding) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
            else {
              viewport.scrollTop = viewport.scrollHeight;
              batch(() => {
                setScrollTop(viewport!.scrollTop);
                setIsAtBottom(true);
              });
            }
          });
        } else if (shift !== 0 && viewport && currentScroll > 0 && !isSmoothScrolling) {
          viewport.scrollTop += shift;
          setScrollTop(viewport.scrollTop);
        }
        updateScrollSlice();
        checkBoundaries(); // Re-evaluate if height changes put us in threshold
      }
    });

    let previousCount = peek(props.items).length;
    let previousFirstKey: string | number | null = previousCount > 0 ? props.keyFn(peek(props.items)[0]) : null;

    onEffect(c, () => {
      const currentItems = props.items();
      const currentCount = currentItems.length;
      const currentFirstKey = currentCount > 0 ? props.keyFn(currentItems[0]) : null;

      if (
        currentCount > previousCount &&
        previousFirstKey &&
        props.keyFn(currentItems[currentCount - previousCount]) === previousFirstKey
      ) {
        if (viewport) {
          viewport.scrollTop += (currentCount - previousCount) * peek(engine.averageHeight);
          setScrollTop(viewport.scrollTop);
        }
        engine.clearCache();
        hasReachedStart = false; // Unlock prepends
      }

      if (currentCount > previousCount && currentFirstKey === previousFirstKey) {
        hasReachedEnd = false; // Unlock appends
        if (props.enterAnimationMs) {
          for (let i = previousCount; i < currentCount; i++) {
            const newItem = currentItems[i];
            enteringItems.add(newItem);
            setTimeout(() => {
              enteringItems.delete(newItem);
              updateScrollSlice();
            }, props.enterAnimationMs);
          }
        }

        if (props.bottomUp && (peek(isAtBottom) || isAutoGliding) && viewport) {
          isSmoothScrolling = isAutoGliding = true;
          requestAnimationFrame(() => viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" }));
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
        Array.from(el.children[el.children.length - 1].children).forEach((child) => observer.observe(child));

        if (props.bottomUp) {
          el.scrollTop = el.scrollHeight;
          batch(() => {
            setScrollTop(el.scrollTop);
            setIsAtBottom(true);
          });
        }

        if (commandQueue.length > 0) {
          commandQueue.forEach((cmd) => cmd());
          commandQueue.length = 0;
        }

        el.addEventListener("scrollend", () => {
          isSmoothScrolling = isAutoGliding = false;
        });

        let lastSt = el.scrollTop;
        el.addEventListener(
          "scroll",
          () => {
            const st = el.scrollTop;
            setScrollTop(st);
            const distToBottom = el.scrollHeight - st - el.clientHeight;
            const isScrollingUp = st < lastSt;

            if (!isSmoothScrolling) {
              if (isScrollingUp && distToBottom > 15) setIsAtBottom(false);
              else if (!isScrollingUp && distToBottom <= 100) setIsAtBottom(true);
            }
            lastSt = st;

            checkBoundaries();
            updateScrollSlice();
          },
          { passive: true },
        );

        // Bootstrap on next frame to ensure clientHeight is populated
        requestAnimationFrame(() => {
          if (viewport) {
            checkBoundaries();
            updateScrollSlice();
          }
        });

        return () => {
          viewport = null;
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

  function getOffset(index: number, avg: number): number {
    if (index > lastCalculatedIndex) {
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

  function findIndexAtScroll(scrollPos: number, totalItems: number, avg: number): number {
    if (totalItems <= 0) return 0;
    let low = 0,
      high = totalItems - 1,
      foundIndex = 0;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (getOffset(mid, avg) < scrollPos) {
        foundIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return foundIndex;
  }

  function findSticky(scrollPos: number, indices: number[], avg: number) {
    if (!indices.length) return { activeIdx: -1, nextIdx: -1 };

    let low = 0,
      high = indices.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (getOffset(indices[mid], avg) <= scrollPos) low = mid + 1;
      else high = mid - 1;
    }

    return {
      activeIdx: low > 0 ? indices[low - 1] : -1,
      nextIdx: low < indices.length ? indices[low] : -1,
    };
  }

  function updateHeights(entries: { index: number; height: number }[], avg: number): boolean {
    let needsRecalc = false;
    let currentCount = peek(measuredCount);
    let currentTotal = peek(totalMeasuredHeight);

    for (let i = 0; i < entries.length; i++) {
      const { index, height } = entries[i];
      if (height === 0) continue;

      const oldHeight = measuredHeights.get(index) ?? avg;
      if (Math.abs(oldHeight - height) > 0) {
        if (!measuredHeights.has(index)) {
          currentCount++;
          currentTotal += height;
        } else {
          currentTotal += height - oldHeight;
        }
        measuredHeights.set(index, height);
        needsRecalc = true;
      }
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
