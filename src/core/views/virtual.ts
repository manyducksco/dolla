import { state, computed, batch, Reactive, Mutable } from "../reactive.js";
import { createMarkup } from "../markup/utils.js";
import { $watch } from "../hooks.js";

export interface VirtualListProps<T> {
  items: Reactive<T[]>;
  bottomUp?: boolean;
  render: (item: Reactive<T>, index: Reactive<number>) => any;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  const scrollTop = state(0);

  const defaultAssumption = 50;
  const measuredCount = state(0);
  const totalMeasuredHeight = state(0);

  const measuredHeights = new Map<number, number>();
  const offsetCache: number[] = [];
  let lastCalculatedIndex = -1;

  // THE DRIFT FIX: Enforce integer math to prevent floating point array drift
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

    // THE DESYNC FIX: Read from the DOM, not the reactive signal
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

      // THE DRIFT FIX: Round physical pixels to integers
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

      if (props.bottomUp && isAtBottom && viewportElement) {
        // Calculate future height mathematically to bypass DOM lag
        const futureTotal = currentTotal + (totalItems - currentCount) * newAvg;
        viewportElement.scrollTop = futureTotal - viewportElement.clientHeight;
        scrollTop.set(viewportElement.scrollTop);
      } else if (shift !== 0 && viewportElement && currentScroll > 0) {
        viewportElement.scrollTop += shift;
        scrollTop.set(viewportElement.scrollTop);
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
    node: any;
  }

  const pool: PoolSlot[] = Array.from({ length: POOL_SIZE }).map(() => {
    const item = state<T | null>(null);
    const index = state(-1);
    const offset = state(0);
    const active = state(false);

    const renderedNode = props.render(item as Reactive<T>, index);

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

    return { item, index, offset, active, node };
  });

  function updateScrollSlice() {
    // THE DESYNC FIX: Force truth from the DOM
    const currentScroll = viewportElement ? viewportElement.scrollTop : 0;
    const currentAvg = averageHeight.get();
    const data = props.items.get();
    const total = data.length;

    let startIndex = 0;
    while (startIndex < total && getOffset(startIndex, currentAvg) < currentScroll - currentAvg * 5) {
      startIndex++;
    }

    const endIndex = Math.min(total, startIndex + POOL_SIZE);

    batch(() => {
      for (let i = 0; i < POOL_SIZE; i++) pool[i].active.set(false);

      for (let i = startIndex; i < endIndex; i++) {
        const slot = pool[i % POOL_SIZE];
        slot.item.set(data[i]);
        slot.index.set(i);
        slot.offset.set(getOffset(i, currentAvg));
        slot.active.set(true);
      }
    });
  }

  let isPrepending = false;
  let isAtBottom = true;
  let previousCount = 0;
  let previousFirstItem: T | null = null;

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
        scrollTop.set(viewportElement.scrollTop); // Sync the jump
      }

      offsetCache.length = 0;
      lastCalculatedIndex = -1;
      measuredHeights.clear();
    }

    if (!isPrepending && props.bottomUp && isAtBottom && viewportElement) {
      requestAnimationFrame(() => {
        if (viewportElement) {
          viewportElement.scrollTop = viewportElement.scrollHeight;
          scrollTop.set(viewportElement.scrollTop);
        }
      });
    }

    previousCount = currentCount;
    previousFirstItem = currentItems[0] ?? null;
    isPrepending = false;

    updateScrollSlice();
  });

  return createMarkup("div", {
    ref: (el: HTMLElement | null) => {
      viewportElement = el;

      if (el == null) return;

      const children = Array.from(el.children[0].children) as HTMLElement[];
      children.forEach((child) => observer.observe(child));

      if (props.bottomUp) {
        el.scrollTop = el.scrollHeight;
        scrollTop.set(el.scrollTop); // Sync the initial jump
      }

      el.addEventListener(
        "scroll",
        () => {
          scrollTop.set(el.scrollTop);
          // Increased threshold to 30px to handle high DPI floating point padding
          isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
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
    children: createMarkup("div", {
      style: {
        height: () => `${totalHeight.track()}px`,
        width: "100%",
        position: "relative",
      },
      children: pool.map((p) => p.node),
    }),
  });
}
