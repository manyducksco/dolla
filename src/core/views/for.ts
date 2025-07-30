import { useContext } from "../hooks";
import { type Key, RenderFn, RepeatNode } from "../nodes/repeat";
import { type MaybeSignal, readable } from "../signals";

export interface ForProps<T> {
  /**
   * An array of items to render.
   */
  each: MaybeSignal<T[]>;
  /**
   * A function to extract a unique key that identifies each item.
   * If no `key` function is passed, object identity (===) will be used.
   */
  key?: (item: T, index: number) => Key;
  /**
   * A render function. Takes the item and its index in signal form and returns something to display for each item.
   */
  children: RenderFn<T>;
}

const defaultKeyFn = (x: any) => x;

/**
 *
 */
export function For<T>(props: ForProps<T>) {
  const context = useContext("For");
  return new RepeatNode(context, readable(props.each), props.key ?? defaultKeyFn, props.children);
}
