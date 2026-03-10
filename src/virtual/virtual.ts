// import { state, memo, batch, Getter, Setter, peek } from "../core/signals.js";
// import { createMarkup } from "../core/markup/utils.js";
// import { $effect } from "../core/hooks.js";

// export interface VirtualListAPI<T> {
//   scrollToBottom: (smooth?: boolean) => void;
//   scrollToTop: (smooth?: boolean) => void;
//   scrollToIndex: (index: number, options?: { smooth?: boolean; align?: "start" | "center" | "end" }) => void;
//   scrollToItem: (item: T, options?: { smooth?: boolean; align?: "start" | "center" | "end" }) => void;
//   isAtBottom: Getter<boolean>;
// }

// export interface VirtualListContext {
//   isEntering: Getter<boolean>;
// }

// export interface VirtualListProps<T> {
//   items: Getter<T[]>;
//   /** A stable identifier for each item, crucial for detecting changes accurately */
//   keyFn: (item: T) => string | number;
//   bottomUp?: boolean;
//   enterAnimationMs?: number;

//   /** Configuration for the virtual pool */
//   estimatedItemHeight?: number;
//   poolSize?: number;

//   /** Infinite scroll callbacks */
//   onTopReached?: () => void;
//   onBottomReached?: () => void;
//   threshold?: number;

//   render: (item: Getter<T>, index: Getter<number>, context: VirtualListContext) => any;
//   renderEmpty?: () => any;

//   isSticky?: (item: T) => boolean;
//   renderSticky?: (item: Getter<T>) => any;
// }

// export function createVirtualList<T>(props: VirtualListProps<T>): [() => any, VirtualListAPI<T>] {
//   // --- 1. CONFIGURATION & STATE ---
//   const defaultAssumption = props.estimatedItemHeight ?? 50;
//   const POOL_SIZE = props.poolSize ?? 100;
//   const threshold = props.threshold ?? 300;

//   let viewportElement: HTMLElement | null = null;
//   const [scrollTop, setScrollTop] = state(0);
//   const [isAtBottom, setIsAtBottom] = state(true);

//   // --- 2. THE API & COMMAND QUEUE ---
//   // Because the developer receives this API immediately, they might call it
//   // before the DOM has actually rendered. We queue those commands here.
//   const commandQueue: (() => void)[] = [];

//   const api: VirtualListAPI<T> = {
//     scrollToBottom: (smooth = false) => {
//       if (!viewportElement) {
//         commandQueue.push(() => api.scrollToBottom(smooth));
//         return;
//       }
//       if (smooth) {
//         isSmoothScrolling = true;
//         isAutoGliding = true; // Tell the system to stay attached to the bottom
//       }
//       setIsAtBottom(true);
//       viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior: smooth ? "smooth" : "auto" });
//       if (!smooth) {
//         setScrollTop(viewportElement.scrollTop);
//         isAutoGliding = false;
//       }
//     },
//     scrollToTop: (smooth = false) => {
//       if (!viewportElement) {
//         commandQueue.push(() => api.scrollToTop(smooth));
//         return;
//       }
//       if (smooth) isSmoothScrolling = true;
//       isAutoGliding = false; // Break the bottom-lock
//       setIsAtBottom(false);
//       viewportElement.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
//       if (!smooth) setScrollTop(0);
//     },
//     scrollToIndex: (index: number, options = {}) => {
//       if (!viewportElement) {
//         commandQueue.push(() => api.scrollToIndex(index, options));
//         return;
//       }

//       setIsAtBottom(false);
//       isAutoGliding = false;

//       const avg = peek(averageHeight);
//       let targetOffset = getOffset(index, avg);
//       const itemHeight = measuredHeights.get(index) ?? avg;

//       const itemsArray = peek(props.items);
//       const isTargetSticky = props.isSticky && itemsArray[index] ? props.isSticky(itemsArray[index]) : false;

//       // Adjust the final landing coordinate based on the requested alignment
//       if (options.align === "center") {
//         targetOffset -= viewportElement.clientHeight / 2 - itemHeight / 2;
//       } else if (options.align === "end") {
//         targetOffset -= viewportElement.clientHeight - itemHeight;
//       } else if (props.isSticky && !isTargetSticky) {
//         // Leave room for the Phantom Header so it doesn't cover the item
//         targetOffset -= phantomHeight;
//       }

//       // Ensure we don't try to scroll out of bounds
//       targetOffset = Math.max(0, Math.min(targetOffset, viewportElement.scrollHeight - viewportElement.clientHeight));

//       if (options.smooth) isSmoothScrolling = true;
//       viewportElement.scrollTo({ top: targetOffset, behavior: options.smooth ? "smooth" : "auto" });
//       if (!options.smooth) setScrollTop(targetOffset);
//     },
//     scrollToItem: (item: T, options = {}) => {
//       const index = peek(props.items).indexOf(item);
//       if (index !== -1) api.scrollToIndex(index, options);
//     },
//     isAtBottom,
//   };

//   // --- 3. THE MATHEMATICAL OFFSET ENGINE ---
//   // A virtual list must know exactly how tall every item is to calculate the total scrollbar height.
//   // Because heights are dynamic (e.g., text wrapping), we measure them as they render and cache them.
//   const [measuredCount, setMeasuredCount] = state(0);
//   const [totalMeasuredHeight, setTotalMeasuredHeight] = state(0);
//   const measuredHeights = new Map<number, number>();
//   const offsetCache: number[] = [];
//   let lastCalculatedIndex = -1;

//   const averageHeight = memo(() => {
//     const count = measuredCount();
//     const total = totalMeasuredHeight();
//     return count > 0 ? Math.round(total / count) : defaultAssumption;
//   });

//   const totalHeight = memo(() => {
//     const totalItems = props.items().length;
//     const avg = averageHeight();
//     const count = measuredCount();
//     const total = totalMeasuredHeight();
//     // Total Height = Known measured heights + (Remaining unknown items * average height)
//     return total + (totalItems - count) * avg;
//   });

//   // Calculates the exact absolute Y pixel coordinate of any item in the list.
//   function getOffset(index: number, currentAvg: number): number {
//     if (index > lastCalculatedIndex) {
//       for (let i = lastCalculatedIndex + 1; i <= index; i++) {
//         const prevOffset = i === 0 ? 0 : offsetCache[i - 1];
//         const prevHeight = i === 0 ? 0 : (measuredHeights.get(i - 1) ?? currentAvg);
//         offsetCache[i] = prevOffset + prevHeight;
//       }
//       lastCalculatedIndex = index;
//     }
//     return offsetCache[index];
//   }

//   // --- 4. RENDER POOL ---
//   // We only create 100 actual DOM nodes. As the user scrolls, we just change the data
//   // inside these nodes and physically translate them up/down the screen.
//   const enteringItems = new Set<T>();

//   interface PoolSlot {
//     item: Mutable<T | null>;
//     index: Mutable<number>;
//     offset: Mutable<number>;
//     active: Mutable<boolean>;
//     isEntering: Mutable<boolean>;
//     node: any;
//   }

//   const pool: PoolSlot[] = Array.from({ length: POOL_SIZE }).map(() => {
//     const item = state<T | null>(null);
//     const index = state(-1);
//     const offset = state(0);
//     const active = state(false);
//     const isEntering = state(false);

//     const renderedNode = props.render(item as Reactive<T>, index, { isEntering });

//     const node = createMarkup("div", {
//       "data-index": index,
//       style: {
//         position: "absolute",
//         top: "0",
//         left: "0",
//         width: "100%",
//         transform: () => `translateY(${offset.track()}px)`,
//         display: () => (active.track() ? "block" : "none"),
//       },
//       children: renderedNode,
//     });
//     return { item, index, offset, active, isEntering, node };
//   });

//   // --- 5. STICKY HEADER STATE ---
//   const activeStickyItem = state<T | null>(null);
//   const stickyPushOffset = state(0);
//   let phantomHeight = 0;

//   const stickyIndices = computed(() => {
//     if (!props.isSticky) return [];
//     const items = props.items.track();
//     const indices: number[] = [];
//     for (let i = 0; i < items.length; i++) {
//       if (props.isSticky(items[i])) indices.push(i);
//     }
//     return indices;
//   });

//   // --- 6. SCROLL & COLLISION ROUTER ---
//   // This runs continuously as the user scrolls. It decides which 100 items should
//   // be visible and calculates the iOS-style sticky header push effect.
//   function updateScrollSlice() {
//     const currentScroll = viewportElement ? viewportElement.scrollTop : 0;
//     const currentAvg = averageHeight.peek();
//     const data = props.items.peek();
//     const total = data.length;

//     // Fast-forward to find the first item that is currently visible in the viewport
//     let startIndex = 0;
//     while (startIndex < total && getOffset(startIndex, currentAvg) < currentScroll - currentAvg * 5) {
//       startIndex++;
//     }

//     // Sticky Header Collision Engine
//     if (props.isSticky && props.renderSticky) {
//       const indices = stickyIndices.peek();
//       let activeIdx = -1;
//       let nextIdx = -1;
//       for (let i = 0; i < indices.length; i++) {
//         const offset = getOffset(indices[i], currentAvg);
//         if (offset <= currentScroll) {
//           activeIdx = indices[i];
//         } else {
//           nextIdx = indices[i];
//           break; // Next incoming header found
//         }
//       }

//       const newActive = activeIdx !== -1 ? data[activeIdx] : null;
//       if (activeStickyItem.peek() !== newActive) activeStickyItem.set(newActive);

//       let push = 0;
//       if (nextIdx !== -1 && phantomHeight > 0) {
//         const nextOffset = getOffset(nextIdx, currentAvg);
//         const distanceToNext = nextOffset - currentScroll;
//         // If the next header touches the phantom node, physically translate the phantom up
//         if (distanceToNext < phantomHeight) push = distanceToNext - phantomHeight;
//       }
//       if (stickyPushOffset.peek() !== push) stickyPushOffset.set(push);
//     }

//     // Map the visible data slice into the recycled DOM nodes
//     batch(() => {
//       for (let i = 0; i < POOL_SIZE; i++) pool[i].active.set(false);
//       const endIndex = Math.min(total, startIndex + POOL_SIZE);
//       for (let i = startIndex; i < endIndex; i++) {
//         const slot = pool[i % POOL_SIZE]; // Loop around the pool
//         const currentData = data[i];
//         slot.item.set(currentData);
//         slot.index.set(i);
//         slot.offset.set(getOffset(i, currentAvg));
//         slot.active.set(true);
//         slot.isEntering.set(enteringItems.has(currentData));
//       }
//     });
//   }

//   // --- 7. DOM SYNCHRONIZATION (RESIZE OBSERVER) ---
//   // Listens to the browser painting. When a node's physical height changes,
//   // we record it and mathematically adjust the scrollbar to prevent layout thrashing.
//   let isSmoothScrolling = false; // True when any camera animation is active
//   let isAutoGliding = false; // True ONLY when following new messages at the bottom

//   const observer = new ResizeObserver((entries) => {
//     let needsRecalculation = false;
//     const currentScroll = viewportElement ? viewportElement.scrollTop : 0;
//     const oldAvg = averageHeight.peek();

//     // Find out which item is pinned to the top of the screen before the heights change
//     let anchorIndex = 0;
//     const totalItems = props.items.peek().length;
//     while (anchorIndex < totalItems && getOffset(anchorIndex, oldAvg) < currentScroll) {
//       anchorIndex++;
//     }
//     const oldAnchorOffset = getOffset(anchorIndex, oldAvg);

//     let currentCount = measuredCount.peek();
//     let currentTotal = totalMeasuredHeight.peek();

//     for (const entry of entries) {
//       const node = entry.target as HTMLElement;
//       const dataIndex = Number(node.dataset.index);
//       if (isNaN(dataIndex)) continue;

//       const newHeight = Math.round(entry.borderBoxSize[0].blockSize);
//       if (newHeight === 0) continue;

//       const oldHeight = measuredHeights.get(dataIndex) ?? oldAvg;
//       if (Math.abs(oldHeight - newHeight) > 0) {
//         if (!measuredHeights.has(dataIndex)) {
//           currentCount++;
//           currentTotal += newHeight;
//         } else {
//           currentTotal += newHeight - oldHeight;
//         }
//         measuredHeights.set(dataIndex, newHeight);
//         needsRecalculation = true;
//       }
//     }

//     if (needsRecalculation) {
//       measuredCount.set(currentCount);
//       totalMeasuredHeight.set(currentTotal);
//       lastCalculatedIndex = -1; // Bust the cache

//       const newAvg = currentCount > 0 ? Math.round(currentTotal / currentCount) : defaultAssumption;
//       const newAnchorOffset = getOffset(anchorIndex, newAvg);

//       // The distance the math shifted while the camera stayed still
//       const shift = newAnchorOffset - oldAnchorOffset;

//       const effectivelyAtBottom = isAtBottom.peek() || isAutoGliding;

//       if (props.bottomUp && effectivelyAtBottom && viewportElement) {
//         requestAnimationFrame(() => {
//           if (viewportElement) {
//             if (isAutoGliding) {
//               viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior: "smooth" });
//             } else {
//               // Synchronous snap to maintain the bottom-lock instantly
//               viewportElement.scrollTop = viewportElement.scrollHeight;
//               scrollTop.set(viewportElement.scrollTop);
//               isAtBottom.set(true);
//             }
//           }
//         });
//       } else if (shift !== 0 && viewportElement && currentScroll > 0) {
//         if (!isSmoothScrolling) {
//           // Synchronous snap to prevent items from visually jumping when heights change
//           viewportElement.scrollTop += shift;
//           scrollTop.set(viewportElement.scrollTop);
//         }
//       }
//       updateScrollSlice();
//     }
//   });

//   // --- 8. DATA MUTATION WATCHER ---
//   let previousCount = props.items.peek().length;
//   let previousFirstKey: string | number | null = props.items.peek()[0] ? props.keyFn(props.items.peek()[0]) : null;

//   $watch(() => {
//     const currentItems = props.items.track();
//     const currentCount = currentItems.length;
//     const currentFirstKey = currentItems[0] ? props.keyFn(currentItems[0]) : null;

//     // Detect if items were PREPENDED (added to the top, like loading history)
//     if (
//       currentCount > previousCount &&
//       previousFirstKey &&
//       props.keyFn(currentItems[currentCount - previousCount]) === previousFirstKey
//     ) {
//       const prependedCount = currentCount - previousCount;
//       const addedHeight = prependedCount * averageHeight.peek();
//       if (viewportElement) {
//         viewportElement.scrollTop += addedHeight;
//         scrollTop.set(viewportElement.scrollTop);
//       }
//       offsetCache.length = 0;
//       lastCalculatedIndex = -1;
//       measuredHeights.clear();
//     }

//     // Detect if items were APPENDED (added to the bottom, like a new message)
//     const isAppending = currentCount > previousCount && currentFirstKey === previousFirstKey;

//     if (isAppending) {
//       if (props.enterAnimationMs) {
//         for (let i = previousCount; i < currentCount; i++) {
//           const newItem = currentItems[i];
//           enteringItems.add(newItem);
//           setTimeout(() => {
//             enteringItems.delete(newItem);
//             updateScrollSlice();
//           }, props.enterAnimationMs);
//         }
//       }

//       const effectivelyAtBottom = isAtBottom.peek() || isAutoGliding;

//       if (props.bottomUp && effectivelyAtBottom && viewportElement) {
//         isSmoothScrolling = true;
//         isAutoGliding = true;

//         requestAnimationFrame(() => {
//           if (viewportElement) {
//             viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior: "smooth" });
//           }
//         });
//       }
//     }

//     previousCount = currentCount;
//     previousFirstKey = currentFirstKey;
//     updateScrollSlice();
//   });

//   // --- 9. THE VIEW FACTORY ---
//   const VirtualListView = () => {
//     let hasReachedStart = false;
//     let hasReachedEnd = false;

//     return createMarkup("div", {
//       ref: (el: HTMLElement) => {
//         viewportElement = el;

//         // Connect the observer to the pool nodes
//         Array.from(el.children[el.children.length - 1].children).forEach((child) => observer.observe(child));

//         if (props.bottomUp) {
//           el.scrollTop = el.scrollHeight;
//           scrollTop.set(el.scrollTop);
//           isAtBottom.set(true);
//         }

//         // Flush pre-mount API calls
//         if (commandQueue.length > 0) {
//           commandQueue.forEach((cmd) => cmd());
//           commandQueue.length = 0;
//         }

//         el.addEventListener("scrollend", () => {
//           isSmoothScrolling = false;
//           isAutoGliding = false;
//         });

//         let lastScrollTop = el.scrollTop;
//         el.addEventListener(
//           "scroll",
//           () => {
//             const st = el.scrollTop;
//             scrollTop.set(st);

//             const distanceToBottom = el.scrollHeight - st - el.clientHeight;
//             const isScrollingUp = st < lastScrollTop;

//             // Infinite Scroll Callbacks
//             if (st <= threshold) {
//               if (!hasReachedStart) {
//                 hasReachedStart = true;
//                 if (props.onTopReached) props.onTopReached();
//               }
//             } else {
//               hasReachedStart = false; // Unlock when scrolling away from the top
//             }

//             if (distanceToBottom <= threshold) {
//               if (!hasReachedEnd) {
//                 hasReachedEnd = true;
//                 if (props.onBottomReached) props.onBottomReached();
//               }
//             } else {
//               hasReachedEnd = false; // Unlock when scrolling away from the bottom
//             }

//             // Detach/Re-attach the auto-scroll based on manual user movement
//             if (!isSmoothScrolling) {
//               if (isScrollingUp && distanceToBottom > 15) {
//                 isAtBottom.set(false);
//               } else if (!isScrollingUp && distanceToBottom <= 100) {
//                 isAtBottom.set(true);
//               }
//             }
//             lastScrollTop = st;
//             updateScrollSlice();
//           },
//           { passive: true },
//         );

//         updateScrollSlice();

//         return () => {
//           viewportElement = null;
//         };
//       },
//       style: {
//         position: "relative",
//         overflowY: "auto",
//         overflowX: "hidden",
//         height: "100%",
//         width: "100%",
//         contain: "content",
//       },
//       children: [
//         // Optional Empty State
//         props.renderEmpty && props.items.track().length === 0 ? props.renderEmpty() : null,

//         // The Phantom Sticky Overlay
//         props.renderSticky &&
//           createMarkup("div", {
//             style: {
//               position: "sticky",
//               top: "0",
//               left: "0",
//               width: "100%",
//               height: "0px", // Takes up 0 space in the DOM flow to prevent layout offset bugs
//               zIndex: "10",
//               overflow: "visible",
//             },
//             children: createMarkup("div", {
//               ref: (el: HTMLElement) => {
//                 const observer = new ResizeObserver((entries) => {
//                   phantomHeight = entries[0].borderBoxSize[0].blockSize;
//                   updateScrollSlice();
//                 });
//                 observer.observe(el);
//                 return () => {
//                   observer.disconnect();
//                 };
//               },
//               style: {
//                 transform: () => `translateY(${stickyPushOffset.track()}px)`,
//                 display: () => (activeStickyItem.track() !== null ? "block" : "none"),
//               },
//               children: props.renderSticky(activeStickyItem as Reactive<T>),
//             }),
//           }),

//         // The Mathematical Spacer
//         createMarkup("div", {
//           style: { height: () => `${totalHeight.track()}px`, width: "100%", position: "relative" },
//           children: pool.map((p) => p.node),
//         }),
//       ],
//     });
//   };

//   return [VirtualListView, api];
// }
