import { m, Markup } from "./core/markup";
export { Fragment } from "./core/views/fragment";

export function jsxDEV(element, props, key, isStaticChildren, source, self) {
  return new Markup(element, key != null ? { ...props, key } : props);
}

// function omit(keys, object) {
//   const result = {};
//   for (const key in object) {
//     if (!keys.includes(key)) {
//       result[key] = object[key];
//     }
//   }
//   return result;
// }
