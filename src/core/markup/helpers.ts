import type { MaybeGetter, Renderable } from "../../types.js";
import { isArray, isFunction } from "../../utils.js";
import { createMarkup } from "./utils.js";
import { compose, type Getter } from "../signals.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { PortalNode } from "./nodes/portal.js";
import { RepeatNode, type KeyFn, type RenderFn } from "./nodes/repeat.js";

/**
 * Creates a portal that renders `content` into another element on the page.
 **/
export function createPortal(parent: Element, content: Renderable) {
  return createMarkup(PortalNode, { args: [content, parent] });
}

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
 * Shows content if `condition` is **truthy**. Otherwise shows `fallback` content.
 *
 * @param condition - Condition to hide or show content on.
 * @param content - Content to display when condition is truthy.
 * @param fallback - Content to display when condition is falsy.
 */
export function showIf(condition: MaybeGetter<any>, content: Renderable, fallback?: Renderable): Renderable {
  return _conditional(condition, content, fallback);
}

/**
 * Shows content if `condition` is **falsy**. Otherwise shows `fallback` content.
 *
 * @param condition - Condition to hide or show content on.
 * @param content - Content if condition is falsy.
 * @param fallback - Content if condition is truthy.
 */
export function hideIf(condition: MaybeGetter<any>, content: Renderable, fallback?: Renderable): Renderable {
  return _conditional(condition, fallback, content);
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
    return reactiveBranch(
      () => Boolean(condition()),
      [
        [true, whenTruthy],
        [false, whenFalsy],
      ],
    );
  } else if (condition) {
    return whenTruthy;
  } else {
    return whenFalsy;
  }
}

export type BranchTuple<T = unknown> = readonly [value: T, content: Renderable];

function toPropertyKey(value: unknown): PropertyKey {
  return typeof value === "symbol" ? value : String(value);
}

/**
 * Renders content based on a reactive value, like a `switch` statement.
 *
 * Cases can be provided as an object keyed by the match values, or as an array
 * of `[value, content]` tuples. The tuple form supports matching any value,
 * including objects (by identity), while the object form uses normal object
 * property keys.
 *
 * When no case matches, `fallback` is rendered.
 *
 * @param value - Value to match. Can be reactive.
 * @param cases - Object of cases or array of `[value, content]` tuples.
 * @param fallback - Content to display when no case matches.
 */
export function branch<T extends PropertyKey | boolean>(
  value: MaybeGetter<T>,
  cases: Partial<Record<PropertyKey, Renderable>>,
  fallback?: Renderable,
): Renderable;
export function branch<T>(value: MaybeGetter<T>, cases: readonly BranchTuple<T>[], fallback?: Renderable): Renderable;
export function branch<T>(
  value: MaybeGetter<T>,
  cases: Partial<Record<PropertyKey, Renderable>> | readonly BranchTuple<T>[],
  fallback?: Renderable,
): Renderable {
  const tupleForm = isArray(cases);

  // Short circuit on static value.
  if (!isFunction(value)) {
    if (tupleForm) {
      for (const [key, content] of cases as readonly BranchTuple<T>[]) {
        if (key === value) return content;
      }
      return fallback;
    }

    const key = toPropertyKey(value);
    return Object.hasOwn(cases as object, key) ? (cases as Partial<Record<PropertyKey, Renderable>>)[key] : fallback;
  }

  const entries: readonly BranchTuple[] = tupleForm
    ? (cases as readonly BranchTuple<T>[])
    : Reflect.ownKeys(cases as object).map(
        (key): BranchTuple => [key, (cases as Partial<Record<PropertyKey, Renderable>>)[key]],
      );

  const selector = tupleForm ? (value as Getter<unknown>) : () => toPropertyKey((value as Getter<T>)());

  return reactiveBranch(selector, entries, fallback);
}

/**
 * Renders the content of the case matching `selector`. Content is rebuilt only
 * when a different case is selected, so each case starts fresh when it becomes
 * active.
 */
function reactiveBranch(selector: Getter<unknown>, entries: readonly BranchTuple[], fallback?: Renderable): Renderable {
  // Wrap each case in an object so the fallback and a case whose key is
  // `undefined` stay distinct, even when they hold the same content.
  const cases = entries.map(([key, content]) => ({ key, content }));
  const fallbackCase = { content: fallback };

  const active = compose(() => {
    const key = selector();
    return cases.find((c) => c.key === key) ?? fallbackCase;
  });

  return createMarkup(DynamicNode, { args: [() => active().content] });
}
