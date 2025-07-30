import type { Renderable } from "../../types";
import type { Context } from "../context";
import { useContext } from "../hooks";
import { DynamicNode } from "../nodes/dynamic";
import { get, type MaybeSignal, memo, readable } from "../signals";

export interface ShowProps {
  /**
   * If present, children will be rendered only when this signal holds a truthy value.
   */
  when?: MaybeSignal<any>;

  /**
   * If present, children will be rendered only when this signal holds a falsy value.
   */
  unless?: MaybeSignal<any>;

  /**
   * Content to render if conditions permit.
   */
  children: Renderable;

  /**
   * Content to render when conditions don't permit `children` to render.
   */
  fallback?: Renderable;
}

/**
 * Conditionally display children.
 */
export function Show(props: ShowProps) {
  const context = useContext("Show");

  // Memoize conditions to avoid unnecessarily triggering DynamicNode updates.
  const when = props.when ? readable(props.when) : null;
  const unless = props.unless ? readable(props.unless) : null;

  return new DynamicNode(context, () => {
    let shouldShow = true;

    if (when != null && unless != null) {
      shouldShow = get(when) && !get(unless);
    } else if (when != null) {
      shouldShow = get(when);
    } else if (unless != null) {
      shouldShow = !get(unless);
    }

    if (shouldShow) {
      return props.children;
    } else {
      return props.fallback;
    }
  });
}
