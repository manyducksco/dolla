import { $$context } from "../hooks";
import { type Key, type RenderFn, RepeatNode } from "../markup/nodes/repeat";
import { getter, type Getter } from "../reactive";

export interface ForProps<T> {
  /**
   * An array of items to render.
   */
  each: Getter<T[]> | T[];

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
  const context = $$context();
  context.setName("dolla:For");

  return new RepeatNode(
    context,
    getter(props.each),
    props.key ?? defaultKeyFn,
    Array.isArray(props.children) ? props.children[0] : props.children,
  );
}
