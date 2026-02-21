import { $setup, state } from "../core";

/**
 * Determines if the tab is currently active.
 */
export function $active() {
  const isVisible = state(document.visibilityState === "visible");

  $setup(() => {
    const handler = () => isVisible.write(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  });

  return isVisible;
}
