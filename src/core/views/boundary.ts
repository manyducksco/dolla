import { isFunction } from "../../typeChecking.js";
import { Renderable, View } from "../../types.js";
import { ErrorInfo } from "../context.js";
import { $$context } from "../hooks.js";
import { createMarkup } from "../markup.js";
import { DynamicNode } from "../nodes/dynamic.js";
import { computed, state } from "../signal.js";
import { CrashViewProps } from "./default-crash-view.js";

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
    errorInfo.write({ error, info });
    props.onError?.(error, info);
  });

  return new DynamicNode(
    context,
    computed(() => {
      if (errorInfo.track()) {
        if (isFunction(props.fallback)) {
          return createMarkup(props.fallback, errorInfo.read());
        } else {
          return props.fallback;
        }
      } else {
        return props.children;
      }
    }),
  );
}
