import type { Renderable } from "../../types";
import { $$context } from "../hooks";
import { DynamicNode } from "../nodes/dynamic";
import { computed, reader, type Trackable } from "../reactive";

export interface ShowProps {
  /**
   * If present, children will be rendered only when this signal holds a truthy value.
   */
  when?: Trackable<any>;

  /**
   * If present, children will be rendered only when this signal holds a falsy value.
   */
  unless?: Trackable<any>;

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
  const context = $$context();
  context.setName("dolla:Show");

  // Memoize conditions to avoid unnecessarily triggering DynamicNode updates.
  const when = props.when ? reader(props.when) : null;
  const unless = props.unless ? reader(props.unless) : null;

  return new DynamicNode(
    context,
    computed(() => {
      let shouldShow = true;

      if (when != null && unless != null) {
        shouldShow = when.track() && !unless.track();
      } else if (when != null) {
        shouldShow = when.track();
      } else if (unless != null) {
        shouldShow = !unless.track();
      }

      if (shouldShow) {
        return props.children;
      } else {
        return props.fallback;
      }
    }),
  );
}
