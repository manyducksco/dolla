import { Markup } from "./core/markup";
export { Fragment } from "./core/views/fragment";

/**
 * JSX function for elements with dynamic children.
 */
export function jsx(element, props, key) {
  return new Markup(element, key != null ? { ...props, key } : props);
}

/**
 * JSX function for elements with static children.
 */
export function jsxs(element, props, key) {
  return new Markup(element, key != null ? { ...props, key } : props);
}
