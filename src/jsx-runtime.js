import { markup } from "./core/markup";
export { Fragment } from "./core/views/fragment";

/**
 * JSX function for elements with dynamic children.
 */
export function jsx(element, props, key) {
  return markup(element, props ? { ...omit(["children", "key"], props) } : undefined, ...[props.children]);
}

/**
 * JSX function for elements with static children.
 */
export function jsxs(element, props, key) {
  return markup(element, props ? { ...omit(["children", "key"], props) } : undefined, props.children);
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
