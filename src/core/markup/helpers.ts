import { createMarkup, Renderable } from "..";
import { computed, isReactive, isTrackable, MaybeReactive, reader, track } from "../reactive";
import { KeyFn, RenderFn } from "./nodes/repeat";

/**
 * Displays a dynamic list. Items will be added and removed as the list is updated.
 *
 * @param items - List items. Can be reactive.
 * @param key - Takes (item, index) as plain values and returns a unique key to identify that item (usually the item's ID).
 * @param render - Takes (item, index) as Reactive values and returns content to display for that item.
 */
export function each<T>(items: MaybeReactive<Iterable<T>>, key: KeyFn<T>, render: RenderFn<T>): Renderable {
  if (isReactive(items)) {
    return createMarkup("$repeat", { items, key, render });
  } else {
    return Array.from(items).map((item, index) => render(reader(item), reader(index)));
  }
}

/**
 * Displays content conditionally. When `condition` is truthy, display `content`. When `condition` is falsy, display `fallback`.
 *
 * @param condition - Condition to hide or show content on. Can be reactive.
 * @param content - Content to display when condition is truthy.
 * @param fallback - Content to display when condition is falsy.
 */
export function when(condition: any, content?: Renderable, fallback?: Renderable): Renderable {
  if (isTrackable(condition)) {
    return createMarkup("$dynamic", {
      slot: computed(() => (track(condition) ? content : fallback)),
    });
  } else if (condition) {
    return content;
  } else {
    return fallback;
  }
}
