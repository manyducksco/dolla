import { markup } from "./core/markup";
export { Fragment } from "./core/views/fragment";

export function jsxDEV(element, props, key, isStaticChildren, source, self) {
  const attributes = { ...omit(["children", "key"], props) };
  const children = Array.isArray(props.children) ? props.children : [props.children];

  // return new _Markup(element, attributes, children);
  return markup(element, attributes, ...children);
}

function omit(keys, object) {
  const result = {};
  for (const key in object) {
    if (!keys.includes(key)) {
      result[key] = object[key];
    }
  }
  return result;
}
