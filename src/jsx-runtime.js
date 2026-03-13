import { createMarkup } from "./core/markup/utils.js";

export const Fragment = ({ children }) => children;

/**
 * JSX function for elements with dynamic children.
 */
export function jsx(element, props, key) {
  return createMarkup(element, key != null ? { ...props, key } : props);
}

/**
 * JSX function for elements with static children.
 */
export function jsxs(element, props, key) {
  return createMarkup(element, key != null ? { ...props, key } : props);
}
