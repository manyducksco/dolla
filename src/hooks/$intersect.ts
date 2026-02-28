import { $$context, $setup, state } from "../core";
import { VIEW, ViewNode } from "../core/markup/nodes/view";

interface IntersectOptions extends IntersectionObserverInit {}

/**
 * Uses IntersectionObserver to determine if this view is in the viewport.
 */
export function $intersect(options?: IntersectOptions) {
  const context = $$context();
  const intersecting = state(false);

  const view = context.state[VIEW] as ViewNode<unknown>;
  if (view == null) {
    throw new Error("$intersect must be called inside a view.");
  }

  $setup(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;

      intersecting.set(entry.isIntersecting);
    }, options);

    const root = view.getRoot();
    if (root && root instanceof Element) {
      observer.observe(root);
    }

    return () => {
      observer.disconnect();
    };
  });

  return intersecting;
}
