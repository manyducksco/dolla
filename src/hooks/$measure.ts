import { $$context, $setup, Reactive, state } from "../core";
import { VIEW, ViewNode } from "../core/nodes/view";

export interface Dimensions {
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
  aspectRatio: number;
}

export function $measure(): Reactive<Dimensions> {
  const rect = state<Dimensions>({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    aspectRatio: 1,
  });

  const context = $$context();
  const view = context.getState<ViewNode<unknown>>(VIEW);
  if (view == null) {
    throw new Error("$measure must be called inside a view.");
  }

  $setup(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const { width, height, top, left, bottom, right } = entry.contentRect;

      rect.set({
        width,
        height,
        top,
        left,
        bottom,
        right,
        aspectRatio: width / (height || 1),
      });
    });

    const root = view.getRoot();
    if (root && root instanceof Element) {
      observer.observe(root);
    }

    return () => observer.disconnect();
  });

  return rect;
}
