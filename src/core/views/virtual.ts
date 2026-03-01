import { state, computed, batch, Reactive, Mutable } from "../reactive.js";
import { createMarkup } from "../markup/utils.js";
import { $watch } from "../hooks.js";

export interface VirtualListProps<T> {
  items: Reactive<T[]>;
  bottomUp?: boolean;
  render: (item: Reactive<T>, index: Reactive<number>) => any;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  // 1. Core State & Caches
  // const viewportHeight = state(800);
  const scrollTop = state(0);

  const defaultAssumption = 50;
  let measuredCount = 0;
  let totalMeasuredHeight = 0;

  const measuredHeights = new Map<number, number>();
  const offsetCache: number[] = [];
  let lastCalculatedIndex = -1;

  // 2. Computed Math Engine
  const averageHeight = computed(() => {
    // Only track what is strictly necessary
    return measuredCount > 0 ? totalMeasuredHeight / measuredCount : defaultAssumption;
  });

  const totalHeight = computed(() => {
    const totalItems = props.items.track().length;
    const avg = averageHeight.track();
    const unmeasuredCount = totalItems - measuredCount;
    return totalMeasuredHeight + unmeasuredCount * avg;
  });

  // O(1) Offset calculation with lazy caching
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

  // 3. The Resize Observer (Layout Corrections)
  let viewportElement: HTMLElement | null = null;

  const observer = new ResizeObserver((entries) => {
    let needsRecalculation = false;
    let heightDelta = 0;
    const currentAvg = averageHeight.get(); // imperative read

    for (const entry of entries) {
      const node = entry.target as HTMLElement;
      const dataIndex = Number(node.dataset.index);

      // Ignore nodes that haven't been assigned real data yet
      if (isNaN(dataIndex)) continue;

      const newHeight = entry.borderBoxSize[0].blockSize;
      const oldHeight = measuredHeights.get(dataIndex) ?? currentAvg;

      if (Math.abs(oldHeight - newHeight) > 1) {
        // 1px threshold for subpixel jitter
        if (!measuredHeights.has(dataIndex)) {
          measuredCount++;
          totalMeasuredHeight += newHeight;
        } else {
          totalMeasuredHeight += newHeight - oldHeight;
        }

        measuredHeights.set(dataIndex, newHeight);
        heightDelta += newHeight - oldHeight;
        needsRecalculation = true;

        // Invalidate cache from this index downwards
        lastCalculatedIndex = Math.min(lastCalculatedIndex, dataIndex - 1);
      }
    }

    if (needsRecalculation) {
      // Find the first index currently visible in the viewport
      let firstVisibleIndex = 0;
      while (getOffset(firstVisibleIndex, currentAvg) < scrollTop.get()) {
        firstVisibleIndex++;
      }

      // If the items resizing are ABOVE the user's current view, shift the scroll
      // position to absorb the layout jump seamlessly.
      if (entries.some((e) => Number((e.target as HTMLElement).dataset.index) < firstVisibleIndex)) {
        if (viewportElement) viewportElement.scrollTop += heightDelta;
      }

      // Force a re-render of the visible slice
      updateScrollSlice();
    }
  });

  // 4. The Node Recycling Pool
  // We allocate a safe maximum. If average height is 50px, 100 nodes cover 5000px of screen.
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

    // Pass signals to the user's render function
    const renderedNode = props.render(item as Reactive<T>, index);

    const node = createMarkup("div", {
      // Store the current index on the DOM node for the ResizeObserver to read
      "data-index": index,
      style: {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        transform: () => `translateY(${offset.track()}px)`,
        // Hide nodes that are currently unused (e.g., array has 5 items, pool has 100)
        display: () => (active.track() ? "block" : "none"),
      },
      children: renderedNode,
    });

    return { item, index, offset, active, node };
  });

  // 5. The Modulo Routing Engine (Hot Path)
  function updateScrollSlice() {
    const currentScroll = scrollTop.get();
    const currentAvg = averageHeight.get();
    const data = props.items.get();
    const total = data.length;

    // Fast-forward to the first visible item
    let startIndex = 0;
    while (startIndex < total && getOffset(startIndex, currentAvg) < currentScroll - currentAvg * 5) {
      startIndex++;
    }

    const endIndex = Math.min(total, startIndex + POOL_SIZE);

    batch(() => {
      // Deactivate all nodes temporarily
      for (let i = 0; i < POOL_SIZE; i++) pool[i].active.set(false);

      // Route data to physical nodes via modulo
      for (let i = startIndex; i < endIndex; i++) {
        const slot = pool[i % POOL_SIZE];
        slot.item.set(data[i]);
        slot.index.set(i);
        slot.offset.set(getOffset(i, currentAvg));
        slot.active.set(true);
      }
    });
  }

  // 6. Bottom-Up Chat Mechanics
  let isPrepending = false;
  let isAtBottom = true;
  let previousCount = 0;
  let previousFirstItem: T | null = null;

  $watch(() => {
    const currentItems = props.items.track(); // Reactive subscription to array changes
    const currentCount = currentItems.length;

    if (
      currentCount > previousCount &&
      previousFirstItem &&
      currentItems[currentCount - previousCount] === previousFirstItem
    ) {
      isPrepending = true;
      const prependedCount = currentCount - previousCount;
      const addedHeight = prependedCount * averageHeight.get();

      if (viewportElement) viewportElement.scrollTop += addedHeight;

      // Wipe offset cache since all indexes shifted
      offsetCache.length = 0;
      lastCalculatedIndex = -1;
      measuredHeights.clear(); // Reset exact measurements since indexes moved
    }

    if (!isPrepending && props.bottomUp && isAtBottom && viewportElement) {
      requestAnimationFrame(() => {
        if (viewportElement) viewportElement.scrollTop = viewportElement.scrollHeight;
      });
    }

    previousCount = currentCount;
    previousFirstItem = currentItems[0] ?? null;
    isPrepending = false;

    // Trigger modulo assignment on array changes
    updateScrollSlice();
  });

  // 7. Mount & Render Layout
  return createMarkup("div", {
    ref: (el: HTMLElement | null) => {
      viewportElement = el;

      if (el == null) return;

      // Attach the ResizeObserver to all pool node wrappers
      const children = Array.from(el.children[0].children) as HTMLElement[];
      children.forEach((child) => observer.observe(child));

      if (props.bottomUp) el.scrollTop = el.scrollHeight;

      el.addEventListener(
        "scroll",
        () => {
          scrollTop.set(el.scrollTop);
          isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
          updateScrollSlice();
        },
        { passive: true },
      );

      // Initial render trigger
      updateScrollSlice();
    },
    style: {
      position: "relative",
      overflowY: "auto",
      overflowX: "hidden",
      height: "100%",
      contain: "strict", // Massive performance boost for scroll containers
    },
    children: createMarkup("div", {
      // The invisible spacer that stretches the scrollbar
      style: {
        height: () => `${totalHeight.track()}px`,
        width: "1px",
        position: "relative",
      },
      // The absolutely positioned render window holding the recycled pool
      children: pool.map((p) => p.node),
    }),
  });
}
