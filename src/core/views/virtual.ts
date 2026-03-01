import { state, computed, batch, Reactive, Mutable } from "../reactive.js";
import { createMarkup } from "../markup/utils.js";
import { $watch } from "../hooks.js";

export interface VirtualListAPI<T> {
  scrollToBottom: (smooth?: boolean) => void;
  scrollToTop: (smooth?: boolean) => void;
  scrollToIndex: (index: number, options?: { smooth?: boolean; align?: "start" | "center" | "end" }) => void;
  scrollToItem: (item: T, options?: { smooth?: boolean; align?: "start" | "center" | "end" }) => void;
}

export interface VirtualListContext {
  isEntering: Reactive<boolean>;
}

export interface VirtualListProps<T> {
  items: Reactive<T[]>;
  bottomUp?: boolean;
  /**
   * How long (in ms) the isEntering signal stays true for newly appended items.
   * Matches the duration of your CSS @keyframes animation.
   */
  enterAnimationMs?: number;
  render: (item: Reactive<T>, index: Reactive<number>, context: VirtualListContext) => any;
  apiRef?: (api: VirtualListAPI<T>) => void;
  isSticky?: (item: T) => boolean;
  renderSticky?: (item: Reactive<T>) => any;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  const scrollTop = state(0);

  console.log(props);

  const defaultAssumption = 50;
  const measuredCount = state(0);
  const totalMeasuredHeight = state(0);

  // The Phantom Header State
  const activeStickyItem = state<T | null>(null);
  const stickyPushOffset = state(0);
  let phantomHeight = 0;

  // Cache the indices of all sticky items so we don't scan the whole array on scroll
  const stickyIndices = computed(() => {
    if (!props.isSticky) return [];
    const items = props.items.track();
    const indices: number[] = [];
    for (let i = 0; i < items.length; i++) {
      if (props.isSticky(items[i])) indices.push(i);
    }
    return indices;
  });

  const measuredHeights = new Map<number, number>();
  const offsetCache: number[] = [];
  let lastCalculatedIndex = -1;

  const enteringItems = new Set<T>();
  let isSmoothScrolling = false;

  const averageHeight = computed(() => {
    const count = measuredCount.track();
    const total = totalMeasuredHeight.track();
    return count > 0 ? Math.round(total / count) : defaultAssumption;
  });

  const totalHeight = computed(() => {
    const totalItems = props.items.track().length;
    const avg = averageHeight.track();
    const count = measuredCount.track();
    const total = totalMeasuredHeight.track();
    const unmeasuredCount = totalItems - count;
    return total + unmeasuredCount * avg;
  });

  function getOffset(index: number, currentAvg: number): number {
    if (index > lastCalculatedIndex) {
      for (let i = lastCalculatedIndex + 1; i <= index; i++) {
        const prevOffset = i === 0 ? 0 : offsetCache[i - 1];
        const prevHeight = i === 0 ? 0 : (measuredHeights.get(i - 1) ?? currentAvg);
        offsetCache[i] = prevOffset + prevHeight;
      }
      lastCalculatedIndex = index;
    }
    return offsetCache[index];
  }

  let viewportElement: HTMLElement | null = null;

  const observer = new ResizeObserver((entries) => {
    let needsRecalculation = false;

    const currentScroll = viewportElement ? viewportElement.scrollTop : 0;
    const oldAvg = averageHeight.get();

    let anchorIndex = 0;
    const totalItems = props.items.get().length;
    while (anchorIndex < totalItems && getOffset(anchorIndex, oldAvg) < currentScroll) {
      anchorIndex++;
    }
    const oldAnchorOffset = getOffset(anchorIndex, oldAvg);

    let currentCount = measuredCount.get();
    let currentTotal = totalMeasuredHeight.get();

    for (const entry of entries) {
      const node = entry.target as HTMLElement;
      const dataIndex = Number(node.dataset.index);

      if (isNaN(dataIndex)) continue;

      const newHeight = Math.round(entry.borderBoxSize[0].blockSize);
      if (newHeight === 0) continue;

      const oldHeight = measuredHeights.get(dataIndex) ?? oldAvg;

      if (Math.abs(oldHeight - newHeight) > 0) {
        if (!measuredHeights.has(dataIndex)) {
          currentCount++;
          currentTotal += newHeight;
        } else {
          currentTotal += newHeight - oldHeight;
        }

        measuredHeights.set(dataIndex, newHeight);
        needsRecalculation = true;
      }
    }

    if (needsRecalculation) {
      measuredCount.set(currentCount);
      totalMeasuredHeight.set(currentTotal);
      lastCalculatedIndex = -1;

      const newAvg = currentCount > 0 ? Math.round(currentTotal / currentCount) : defaultAssumption;
      const newAnchorOffset = getOffset(anchorIndex, newAvg);
      const shift = newAnchorOffset - oldAnchorOffset;

      const effectivelyAtBottom = isAtBottom || isSmoothScrolling;

      if (props.bottomUp && effectivelyAtBottom && viewportElement) {
        requestAnimationFrame(() => {
          if (viewportElement) {
            if (isSmoothScrolling) {
              viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior: "smooth" });
            } else {
              viewportElement.scrollTop = viewportElement.scrollHeight;
              scrollTop.set(viewportElement.scrollTop);
              isAtBottom = true;
            }
          }
        });
      } else if (shift !== 0 && viewportElement && currentScroll > 0) {
        if (!isSmoothScrolling) {
          viewportElement.scrollTop += shift;
          scrollTop.set(viewportElement.scrollTop);
        }
      }

      updateScrollSlice();
    }
  });

  const POOL_SIZE = 100;

  interface PoolSlot {
    item: Mutable<T | null>;
    index: Mutable<number>;
    offset: Mutable<number>;
    active: Mutable<boolean>;
    isEntering: Mutable<boolean>;
    node: any;
  }

  const pool: PoolSlot[] = Array.from({ length: POOL_SIZE }).map(() => {
    const item = state<T | null>(null);
    const index = state(-1);
    const offset = state(0);
    const active = state(false);
    const isEntering = state(false);

    const renderedNode = props.render(item as Reactive<T>, index, { isEntering });

    const node = createMarkup("div", {
      "data-index": index,
      style: {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        transform: () => `translateY(${offset.track()}px)`,
        display: () => (active.track() ? "block" : "none"),
      },
      children: renderedNode,
    });

    return { item, index, offset, active, isEntering, node };
  });

  function updateScrollSlice() {
    const currentScroll = viewportElement ? viewportElement.scrollTop : 0;
    const currentAvg = averageHeight.get();
    const data = props.items.get();
    const total = data.length;

    let startIndex = 0;
    while (startIndex < total && getOffset(startIndex, currentAvg) < currentScroll - currentAvg * 5) {
      startIndex++;
    }

    const endIndex = Math.min(total, startIndex + POOL_SIZE);

    // --- THE STICKY COLLISION ENGINE ---
    if (props.isSticky && props.renderSticky) {
      const indices = stickyIndices.get(); // Read the fast lookup array
      let activeIdx = -1;
      let nextIdx = -1;

      // 1. Find the active header, and the incoming next header
      for (let i = 0; i < indices.length; i++) {
        const offset = getOffset(indices[i], currentAvg);
        if (offset <= currentScroll) {
          activeIdx = indices[i];
        } else {
          nextIdx = indices[i];
          break; // We found the next incoming header!
        }
      }

      // 2. Set the active header content
      const newActive = activeIdx !== -1 ? data[activeIdx] : null;
      if (activeStickyItem.get() !== newActive) {
        activeStickyItem.set(newActive);
      }

      // 3. Calculate the Push Effect
      let push = 0;
      if (nextIdx !== -1 && phantomHeight > 0) {
        const nextOffset = getOffset(nextIdx, currentAvg);
        const distanceToNext = nextOffset - currentScroll;

        // If the incoming header is closer than the height of our Phantom node,
        // we physically push the Phantom node upward by the difference!
        if (distanceToNext < phantomHeight) {
          push = distanceToNext - phantomHeight;
        }
      }

      if (stickyPushOffset.get() !== push) {
        stickyPushOffset.set(push);
      }
    }
    // --- END STICKY COLLISION ENGINE ---

    batch(() => {
      for (let i = 0; i < POOL_SIZE; i++) pool[i].active.set(false);

      for (let i = startIndex; i < endIndex; i++) {
        const slot = pool[i % POOL_SIZE];
        const currentData = data[i];

        slot.item.set(currentData);
        slot.index.set(i);
        slot.offset.set(getOffset(i, currentAvg));
        slot.active.set(true);
        slot.isEntering.set(enteringItems.has(currentData));
      }
    });
  }

  let isPrepending = false;
  let isAtBottom = true;

  let previousCount = props.items.get().length;
  let previousFirstItem: T | null = props.items.get()[0] ?? null;

  $watch(() => {
    const currentItems = props.items.track();
    const currentCount = currentItems.length;

    if (
      currentCount > previousCount &&
      previousFirstItem &&
      currentItems[currentCount - previousCount] === previousFirstItem
    ) {
      isPrepending = true;
      const prependedCount = currentCount - previousCount;
      const addedHeight = prependedCount * averageHeight.get();

      if (viewportElement) {
        viewportElement.scrollTop += addedHeight;
        scrollTop.set(viewportElement.scrollTop);
      }

      offsetCache.length = 0;
      lastCalculatedIndex = -1;
      measuredHeights.clear();
    }

    const isAppending = !isPrepending && currentCount > previousCount && currentItems[0] === previousFirstItem;

    if (isAppending) {
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

      const effectivelyAtBottom = isAtBottom || isSmoothScrolling;

      if (props.bottomUp && effectivelyAtBottom && viewportElement) {
        isSmoothScrolling = true;

        requestAnimationFrame(() => {
          if (viewportElement) {
            viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior: "smooth" });
          }
        });
      }
    }

    previousCount = currentCount;
    previousFirstItem = currentItems[0] ?? null;
    isPrepending = false;

    updateScrollSlice();
  });

  // Expose the API to the parent
  if (props.apiRef) {
    const api: VirtualListAPI<T> = {
      scrollToBottom: (smooth = false) => {
        if (!viewportElement) return;
        if (smooth) isSmoothScrolling = true;

        // Lock intent to the bottom
        isAtBottom = true;

        viewportElement.scrollTo({
          top: viewportElement.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
        if (!smooth) scrollTop.set(viewportElement.scrollTop);
      },
      scrollToTop: (smooth = false) => {
        if (!viewportElement) return;
        if (smooth) isSmoothScrolling = true;

        // Instantly break the bottom-lock
        isAtBottom = false;

        viewportElement.scrollTo({
          top: 0,
          behavior: smooth ? "smooth" : "auto",
        });
        if (!smooth) scrollTop.set(0);
      },
      scrollToIndex: (index: number, options = {}) => {
        if (!viewportElement) return;

        // Instantly break the bottom-lock so appends don't hijack the animation
        isAtBottom = false;

        const avg = averageHeight.get();
        let targetOffset = getOffset(index, avg);
        const itemHeight = measuredHeights.get(index) ?? avg;

        const itemsArray = props.items.get();
        const isTargetSticky = props.isSticky && itemsArray[index] ? props.isSticky(itemsArray[index]) : false;

        if (options.align === "center") {
          targetOffset -= viewportElement.clientHeight / 2 - itemHeight / 2;
        } else if (options.align === "end") {
          targetOffset -= viewportElement.clientHeight - itemHeight;
        } else {
          if (props.isSticky && !isTargetSticky) {
            targetOffset -= phantomHeight;
          }
        }

        targetOffset = Math.max(0, Math.min(targetOffset, viewportElement.scrollHeight - viewportElement.clientHeight));

        if (options.smooth) isSmoothScrolling = true;
        viewportElement.scrollTo({
          top: targetOffset,
          behavior: options.smooth ? "smooth" : "auto",
        });

        if (!options.smooth) scrollTop.set(targetOffset);
      },
      scrollToItem: (item: T, options = {}) => {
        const itemsArray = props.items.get();
        const index = itemsArray.indexOf(item);
        if (index !== -1) api.scrollToIndex(index, options);
      },
    };

    props.apiRef(api);
  }

  return createMarkup("div", {
    ref: (el: HTMLElement | null) => {
      viewportElement = el;

      if (el == null) return;

      const children = Array.from(el.children[0].children) as HTMLElement[];
      children.forEach((child) => observer.observe(child));

      if (props.bottomUp) {
        el.scrollTop = el.scrollHeight;
        scrollTop.set(el.scrollTop);
        isAtBottom = true;
      }

      el.addEventListener("scrollend", () => {
        isSmoothScrolling = false;
      });

      let lastScrollTop = el.scrollTop;

      el.addEventListener(
        "scroll",
        () => {
          const st = el.scrollTop;
          scrollTop.set(st);

          const distanceToBottom = el.scrollHeight - st - el.clientHeight;
          const isScrollingUp = st < lastScrollTop;

          // Only process manual scroll intent if the framework isn't actively gliding
          if (!isSmoothScrolling) {
            if (isScrollingUp && distanceToBottom > 15) {
              // 1. User scrolled up. Detach from the bottom.
              // (The 15px buffer prevents accidental detachments from high-DPI trackpad bounce)
              isAtBottom = false;
            } else if (!isScrollingUp && distanceToBottom <= 100) {
              // 2. User scrolled down. If they cross the 100px threshold, re-engage!
              isAtBottom = true;
            }
          }

          lastScrollTop = st;
          updateScrollSlice();
        },
        { passive: true },
      );

      updateScrollSlice();
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
            ref: (el: HTMLElement | null) => {
              if (el == null) return;
              const ro = new ResizeObserver((entries) => {
                phantomHeight = entries[0].borderBoxSize[0].blockSize;
                updateScrollSlice();
              });
              ro.observe(el);
            },
            style: {
              transform: () => `translateY(${stickyPushOffset.track()}px)`,
              display: () => (activeStickyItem.track() !== null ? "block" : "none"),
            },
            children: props.renderSticky(activeStickyItem as Reactive<T>),
          }),
        }),

      createMarkup("div", {
        style: {
          height: () => `${totalHeight.track()}px`,
          width: "100%",
          position: "relative",
        },
        children: pool.map((p) => p.node),
      }),
    ],
  });
}
