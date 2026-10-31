import { jsx } from "./jsx-runtime.js";

export { Fragment } from "./jsx-runtime.js";

/**
 * Dev JSX function. The extra dev arguments (static children flag, source, self) are ignored.
 */
export function jsxDEV(element, props, key) {
  return jsx(element, props, key);
}
