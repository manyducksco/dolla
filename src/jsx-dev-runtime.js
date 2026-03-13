import { createMarkup } from "./core/markup/utils.js";

export const Fragment = ({ children }) => children;

export function jsxDEV(element, props, key, isStaticChildren, source, self) {
  // TODO: Take additional dev arguments and use them for better debugging.
  return createMarkup(element, key != null ? { ...props, key } : props);
}
