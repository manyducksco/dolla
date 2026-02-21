import { $$context, $setup, state, View } from "../core";
import { VIEW, ViewNode } from "../core/nodes/view";

interface IntersectOptions extends IntersectionObserverInit {}

/**
 * Uses IntersectionObserver to determine if this view is in the viewport.
 */
export function $intersect(options?: IntersectOptions) {
  const context = $$context();
  const intersecting = state(false);

  const view = context.getState<ViewNode<unknown>>(VIEW);

  $setup(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;

      intersecting.write(entry.isIntersecting);
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
