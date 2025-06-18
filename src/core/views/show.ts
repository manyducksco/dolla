import type { Renderable } from "../../types";
import type { Context } from "../context";
import { DynamicNode } from "../nodes/dynamic";
import { get, type Signal } from "../signals";

export interface ShowProps {
  /**
   * If present, children will be rendered only when this signal holds a truthy value.
   */
  when?: Signal<any>;

  /**
   * If present, children will be rendered only when this signal holds a falsy value.
   */
  unless?: Signal<any>;

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
export function Show(props: ShowProps, context: Context) {
  return new DynamicNode(context, () => {
    let shouldShow = true;

    if (props.when != null && props.unless != null) {
      shouldShow = get(props.when) && !get(props.unless);
    } else if (props.when != null) {
      shouldShow = get(props.when);
    } else if (props.unless != null) {
      shouldShow = !get(props.unless);
    }

    if (shouldShow) {
      return props.children;
    } else {
      return props.fallback;
    }
  });
}
