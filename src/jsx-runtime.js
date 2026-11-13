import { createMarkup } from "./core/markup/utils.js";

export const Fragment = ({ children }) => children;

/**
 * JSX function for elements.
 */
export function jsx(element, props, key) {
  // A fragment only groups its children. Returning them directly saves the view
  // and context that rendering `Fragment` as a component would create.
  if (element === Fragment) return props.children;

  return createMarkup(element, key != null ? { ...props, key } : props);
}

/**
 * JSX function for elements with static children. Static children need no special handling.
 */
export const jsxs = jsx;
