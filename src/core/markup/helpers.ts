import { createMarkup, Renderable } from "..";
import { MaybeGetter, memo } from "../reactive";
import { KeyFn, RenderFn } from "./nodes/repeat";

/**
 * Displays a dynamic list. Items will be added and removed as the list is updated.
 *
 * @param items - List items. Can be reactive.
 * @param key - Takes (item, index) as plain values and returns a unique key to identify that item (usually the item's ID).
 * @param render - Takes (item, index) as Reactive values and returns content to display for that item.
 */
export function each<T>(items: MaybeGetter<Iterable<T>>, key: KeyFn<T>, render: RenderFn<T>): Renderable {
  if (typeof items === "function") {
    return createMarkup("$repeat", { items, key, render });
  } else {
    return Array.from(items).map((item, index) =>
      render(
        () => item,
        () => index,
      ),
    );
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
  if (typeof condition === "function") {
    return createMarkup("$dynamic", {
      slot: memo(() => (condition() ? content : fallback)),
    });
  } else if (condition) {
    return content;
  } else {
    return fallback;
  }
}
