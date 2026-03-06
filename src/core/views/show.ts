import type { Renderable } from "../../types";
import { $$context } from "../hooks";
import { DynamicNode } from "../markup/nodes/dynamic";
import { memo, type Getter } from "../reactive";

export interface ShowProps {
  /**
   * If present, children will be rendered only when this signal holds a truthy value.
   */
  when?: Getter<any>;

  /**
   * If present, children will be rendered only when this signal holds a falsy value.
   */
  unless?: Getter<any>;

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
  const when = props.when ? memo(props.when) : null;
  const unless = props.unless ? memo(props.unless) : null;

  return new DynamicNode(
    context,
    memo(() => {
      let shouldShow = true;

      if (when != null && unless != null) {
        shouldShow = when() && !unless();
      } else if (when != null) {
        shouldShow = when();
      } else if (unless != null) {
        shouldShow = !unless();
      }

      if (shouldShow) {
        return props.children;
      } else {
        return props.fallback;
      }
    }),
  );
}
