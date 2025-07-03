import type { Renderable } from "../../types";
import type { Context } from "../context";
import { type Key, RepeatNode } from "../nodes/repeat";
import { type Signal } from "../signals";

export interface ForProps<T> {
  /**
   * An array of items to render.
   */
  each: Signal<T[]>;
  /**
   * A function to extract a unique key that identifies each item.
   * If no `key` function is passed, object identity (===) will be used.
   */
  key?: (item: T, index: number) => Key;
  /**
   * A render function. Takes the item and its index in signal form and returns something to display for each item.
   */
  children: (item: Signal<T>, index: Signal<number>, ctx: Context) => Renderable;
}

const defaultKeyFn = (x: any) => x;

/**
 *
 */
export function For<T>(props: ForProps<T>, context: Context) {
  return new RepeatNode(context, props.each, props.key ?? defaultKeyFn, props.children);
}
