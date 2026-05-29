# Virtual List

A high-performance virtual scrolling list with a recycled DOM pool, sticky headers, and infinite scroll support.

```js
import { createRoot, createAtom, html } from "@manyducks.co/dolla";
import { createVirtualList } from "@manyducks.co/dolla/virtual";

const data = Array.from({ length: 10000 }, (_, i) => ({ id: i, text: `Item ${i}` }));
const [items, setItems] = createAtom(data);
const [VirtualListView, api] = createVirtualList({
  items,
  keyFn: (item) => item.id,
  render: (item) => html`<div>${item().text}</div>`,
  renderEmpty: () => html`<p>No items</p>`,
});

createRoot(document.body).mount(() => html`<${VirtualListView} />`);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `Getter<T[]>` | — | Reactive array of items to display. |
| `keyFn` | `(item: T) => string \| number` | — | Stable identifier for each item. |
| `render` | `(item: Getter<T>, index: Getter<number>, context: VirtualListContext) => any` | — | Renders a single item. |
| `renderEmpty` | `() => any` | — | Rendered when the list is empty. |
| `estimatedItemHeight` | `number` | `50` | Estimated height per item for initial scrollbar sizing. |
| `poolSize` | `number` | `100` | Number of recycled DOM nodes in the pool. |
| `bottomUp` | `boolean` | `false` | Chat-style mode — scroll position locks to the bottom. |
| `enterAnimationMs` | `number` | — | Duration of enter animations for new items. |
| `onTopReached` | `() => void` | — | Called when the user scrolls to the top (for infinite scroll). |
| `onBottomReached` | `() => void` | — | Called when the user scrolls to the bottom (for infinite scroll). |
| `threshold` | `number` | `300` | Pixel distance from edge to trigger infinite scroll callbacks. |
| `isSticky` | `(item: T) => boolean` | — | Identifies sticky header items. |
| `renderSticky` | `(item: Getter<T>) => any` | — | Renders a sticky header overlay. |

## API

`createVirtualList` returns a tuple `[View, VirtualListAPI]`:

| Method | Description |
|---|---|
| `scrollToBottom(smooth?)` | Scroll to the bottom of the list. |
| `scrollToTop(smooth?)` | Scroll to the top of the list. |
| `scrollToIndex(index, options?)` | Scroll to a specific index. Options: `{ smooth?, align?: "start" \| "center" \| "end" }` |
| `scrollToItem(item, options?)` | Scroll to a specific item by reference. |
| `isAtBottom` | `Getter<boolean>` — whether the viewport is at the bottom. |

API calls made before the list is mounted are queued and executed automatically when the DOM is ready.

## Features

### Recycled DOM pool

Only `poolSize` (default 100) DOM nodes are created. As the user scrolls, the data inside each node is swapped out and the node is physically translated to the correct position.

### Height measurement

Item heights are measured via `ResizeObserver` as they render. The scrollbar is dynamically adjusted to prevent layout thrashing when heights change.

### Scroll anchoring

When items are prepended (e.g., loading chat history), the scroll position is mathematically adjusted so the user doesn't jump.

### Sticky headers

Enable `isSticky` and `renderSticky` for iOS-style sticky headers with push animation.

### Enter animations

Set `enterAnimationMs` to fade-in new items appended to the list.
