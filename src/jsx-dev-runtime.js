// import { createLogger } from "./core";
import { createMarkup } from "./core/markup/utils.js";

export { Fragment } from "./core/views/fragment";

export function jsxDEV(element, props, key, isStaticChildren, source, self) {
  // TODO: Take additional dev arguments and use them for better debugging.
  // console.info({ element, props, key, isStaticChildren, source, self });
  return createMarkup(element, key != null ? { ...props, key } : props);
}
