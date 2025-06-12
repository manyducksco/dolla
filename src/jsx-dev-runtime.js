import { createLogger } from "./core";
import { Markup } from "./core/markup";
export { Fragment } from "./core/views/fragment";

export function jsxDEV(element, props, key, isStaticChildren, source, self) {
  // TODO: Take additional dev arguments and use them for better debugging.
  // console.info({ element, props, key, isStaticChildren, source, self });
  return new Markup(element, key != null ? { ...props, key } : props);
}
