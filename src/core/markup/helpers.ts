import { createMarkup, Renderable } from "..";
import { type Getter, memo } from "../signals";
import { DynamicNode } from "./nodes/dynamic";
import { PortalNode } from "./nodes/portal";
import { KeyFn, RenderFn, RepeatNode } from "./nodes/repeat";

/**
 * Displays a dynamic list. Items will be added and removed as the list is updated.
 *
 * @param items - List items. Can be reactive.
 * @param keyFn - Takes (item, index) as plain values and returns a unique key to identify that item (usually the item's ID).
 * @param renderFn - Takes (item, index) as Reactive values and returns content to display for that item.
 */
export function repeat<T>(
  items: Getter<Iterable<T>> | Iterable<T>,
  keyFn: KeyFn<T>,
  renderFn: RenderFn<T>,
): Renderable {
  if (typeof items === "function") {
    return createMarkup(RepeatNode<T>, { args: [items, keyFn, renderFn] });
  } else {
    return Array.from(items).map((item, index) =>
      renderFn(
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
 * @param whenTruthy - Content to display when condition is truthy.
 * @param whenFalsy - Content to display when condition is falsy.
 */
export function show(condition: any, whenTruthy?: Renderable, whenFalsy?: Renderable): Renderable {
  if (typeof condition === "function") {
    return createMarkup(DynamicNode, {
      args: [memo(() => (condition() ? whenTruthy : whenFalsy))],
    });
  } else if (condition) {
    return whenTruthy;
  } else {
    return whenFalsy;
  }
}

export function portal(content: Renderable, parent: Element) {
  return createMarkup(PortalNode, { args: [content, parent] });
}
