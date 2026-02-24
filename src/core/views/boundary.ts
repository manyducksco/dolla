import { isFunction } from "../../typeChecking.js";
import { Renderable, View } from "../../types.js";
import { ErrorInfo } from "../context/context.js";
import { $$context } from "../hooks.js";
import { Markup } from "../markup/markup.js";
import { DynamicNode } from "../markup/nodes/dynamic.js";
import { computed, state } from "../reactive.js";
import { CrashViewProps } from "./_default-crash-view.js";

export interface BoundaryProps {
  /**
   * Content to render if all is well.
   */
  children: Renderable;

  /**
   * Content to render if an error is caught.
   */
  fallback: View<CrashViewProps> | Renderable;

  /**
   * Called when this boundary catches an error.
   */
  onError?: (error: unknown, info: ErrorInfo) => void;
}

/**
 * Shows fallback content when an error occurs inside its children.
 */
export function Boundary(props: BoundaryProps) {
  const context = $$context();
  const errorInfo = state<CrashViewProps>();

  context.catchError((error, info) => {
    errorInfo.set({ error, info });
    props.onError?.(error, info);
  });

  return new DynamicNode(
    context,
    computed(() => {
      if (errorInfo.track()) {
        if (isFunction(props.fallback)) {
          return new Markup(props.fallback, errorInfo.get());
        } else {
          return props.fallback;
        }
      } else {
        return props.children;
      }
    }),
  );
}
