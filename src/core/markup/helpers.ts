import { createMarkup, Renderable } from "..";
import { isFunction } from "../../utils";
import { type Getter, compose } from "../signals";
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
export function forEach<T>(
  items: Getter<Iterable<T>> | Iterable<T>,
  keyFn: KeyFn<T>,
  renderFn: RenderFn<T>,
): Renderable {
  if (isFunction(items)) {
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
function _conditional(condition: any, whenTruthy?: Renderable, whenFalsy?: Renderable): Renderable {
  if (isFunction(condition)) {
    return createMarkup(DynamicNode, {
      args: [compose(() => (condition() ? whenTruthy : whenFalsy))],
    });
  } else if (condition) {
    return whenTruthy;
  } else {
    return whenFalsy;
  }
}

/**
 * Shows content only when `condition` is truthy.
 * It can be a plain value or a Getter to track dynamically.
 *
 * @param condition - Condition to hide or show content on.
 * @param content - Content to display when condition is truthy.
 * @param fallback - Content to display when condition is falsy.
 */
export function showIf(condition: any, content: Renderable, fallback?: Renderable): Renderable {
  return _conditional(condition, content, fallback);
}

/**
 * Shows content only when `condition` is falsy.
 * It can be a plain value or a Getter to track dynamically.
 *
 * @param condition - Condition to hide or show content on.
 * @param content - Content to display when condition is falsy.
 * @param fallback - Content to display when condition is truthy.
 */
export function hideIf(condition: any, content: Renderable, fallback?: Renderable): Renderable {
  return _conditional(condition, fallback, content);
}

/**
 * Creates a portal that renders `content` into another element on the page.
 **/
export function createPortal(parent: Element, content: Renderable) {
  return createMarkup(PortalNode, { args: [content, parent] });
}
