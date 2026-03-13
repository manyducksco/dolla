import { MountTarget } from "./core/markup/types";

export const noOp = () => {};

let lastId = 0;
export function uniqueId() {
  return (lastId++).toString(36);
}

/*=============================*\
||       Object Equality       ||
\*=============================*/

/**
 * Equality check that passes if both values are the same object.
 * This is the default equality check for states.
 */
export function strictEqual(a: any, b: any): boolean {
  return Object.is(a, b);
}

/**
 * Equality check that passes if both values are the same object, or if both are objects or arrays with equal keys and values.
 */
export function shallowEqual(a: any, b: any): boolean {
  if (strictEqual(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;

  if (isArray(a)) {
    if (!isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) if (val !== b.get(key)) return false;
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const val of a) if (!b.has(val)) return false;
    return true;
  }

  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/**
 * Equality check that passes if two objects have equal values, even if they are not the same object.
 */
// NOTE: This code is https://github.com/epoberezkin/fast-deep-equal licensed under MIT.
// I imported it because I couldn't get the old school module to play nice with my modern ES code as an external dependency.
// export function deepEqual(a: any, b: any): boolean {
//   if (a === b) return true;

//   if (a && b && typeof a == "object" && typeof b == "object") {
//     if (a.constructor !== b.constructor) return false;

//     var length, i, keys;
//     if (isArray(a)) {
//       length = a.length;
//       if (length != b.length) return false;
//       for (i = length; i-- !== 0; ) if (!deepEqual(a[i], b[i])) return false;
//       return true;
//     }

//     if (a instanceof Map && b instanceof Map) {
//       if (a.size !== b.size) return false;
//       for (i of a.entries()) if (!b.has(i[0])) return false;
//       for (i of a.entries()) if (!deepEqual(i[1], b.get(i[0]))) return false;
//       return true;
//     }

//     if (a instanceof Set && b instanceof Set) {
//       if (a.size !== b.size) return false;
//       for (i of a.entries()) if (!b.has(i[0])) return false;
//       return true;
//     }

//     if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
//       length = (a as any).length;
//       if (length != (b as any).length) return false;
//       for (i = length; i-- !== 0; ) if ((a as any)[i] !== (b as any)[i]) return false;
//       return true;
//     }

//     if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
//     if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
//     if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

//     keys = Object.keys(a);
//     length = keys.length;
//     if (length !== Object.keys(b).length) return false;

//     for (i = length; i-- !== 0; ) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

//     for (i = length; i-- !== 0; ) {
//       var key = keys[i];

//       if (!deepEqual(a[key], b[key])) return false;
//     }

//     return true;
//   }

//   // true if both NaN, false otherwise
//   return a !== a && b !== b;
// }

/*=============================*\
||         Object Utils        ||
\*=============================*/

/**
 * Takes an old value and a new value.  Returns a merged copy if both are objects, otherwise returns the new value.
 */
export function merge(one: unknown, two: unknown) {
  if (isObject(one)) {
    if (!isObject(two)) {
      return two;
    }

    const merged = Object.assign({}, one) as any;

    for (const key in two) {
      merged[key] = merge(merged[key], two[key]);
    }

    return merged;
  } else {
    return two;
  }
}

/**
 * Returns a new object without the specified keys.
 * If called without object, returns a function that takes an object
 * and returns a version with the original keys omitted.
 *
 * @param keys - An array of keys to omit.
 * @param object - An object to clone without the omitted keys.
 */
export function omit<O extends Record<any, any>>(keys: (keyof O)[], object: O): Record<any, any> {
  const newObject: Record<any, any> = {};

  for (const key in object) {
    if (!keys.includes(key)) {
      newObject[key] = object[key];
    }
  }

  return newObject;
}

/*=============================*\
||          Misc Utils         ||
\*=============================*/

export function toArray<T>(value: T | T[]): T[] {
  if (isArray(value)) {
    return value;
  } else {
    return [value];
  }
}

export function toCamelCase(s: string) {
  return s.replace(/-./g, (x) => x[1].toUpperCase());
}

export function addChild(parent: MountTarget, node: Node, after?: Node | null) {
  if (after) {
    parent.insertBefore(node, after?.nextSibling);
  } else {
    parent.appendChild(node);
  }
}

export function createTextNode(text: string) {
  return document.createTextNode(text);
}

/**
 * Moves an element using `moveBefore` if the browser supports it, otherwise falls back to `insertBefore`.
 */
export function moveBefore(parent: Node, node: Node, child: Node | null) {
  if ("moveBefore" in parent) {
    (parent as any).moveBefore(node, child);
  } else {
    parent.insertBefore(node, child);
  }
}

/**
 * Gets an element from a selector string, or returns the element if passed an Element.
 */
export function getElement(element: string | Element): Element | null {
  return isString(element) ? document.querySelector(element) : element;
}

export function addListener<T extends Event>(target: EventTarget, event: string, listener: (event: T) => any) {
  target.addEventListener(event, listener as any);
  return () => target.removeEventListener(event, listener as any);
}

export function setAttribute(element: Element, name: string, value: any) {
  if (value) {
    element.setAttribute(name, String(value));
  } else {
    element.removeAttribute(name);
  }
}

/**
 * Takes any string and returns an OKLCH color.
 */
export function okhash(value: string) {
  let hue = 0;
  for (let i = 0; i < value.length; i++) {
    hue = (hue + value.charCodeAt(i) * 10) % 360;
  }
  return `oklch(0.68 0.15 ${hue}deg)`;
}

/*=============================*\
||        Type Checking        ||
\*=============================*/

/**
 * Throws a TypeError unless `condition` is truthy.
 *
 * @param value - Value whose truthiness is in question.
 * @param errorMessage - Optional message for the thrown TypeError.
 */
export function assert<T = any>(value: T, errorMessage: string): asserts value is NonNullable<T> {
  if (!value) {
    throw new TypeError(errorMessage);
  }
}

/**
 * Returns true if `value` is an array.
 */
export function isArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value);
}

/**
 * Returns true when `value` is an array and `check` returns true for every item.
 *
 * @param check - Function to check items against.
 * @param value - A possible array.
 */
export function isArrayOf<T>(check: (item: unknown) => boolean, value: unknown): value is T[];
export function isArrayOf<T>(check: (item: unknown) => boolean): (value: unknown) => value is T[];

export function isArrayOf<T>(check: (item: unknown) => boolean, value?: unknown) {
  if (value) {
    return isArray(value) && value.every((item) => check(item));
  } else {
    return (value: unknown) => isArrayOf<T>(check, value);
  }
}

/**
 * Returns true if `value` is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Returns true if `value` is a function (but not a class).
 */
export function isFunction<T = (...args: unknown[]) => unknown>(value: unknown): value is T {
  return typeof value === "function" && !isClass(value);
}

export function isClass(value: unknown) {
  return /^\s*class\s+/.test(String(value));
}

/**
 * Returns true if `value` is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Returns `true` if `value` is an instance of `constructor`.
 *
 * @param constructor - The constructor `value` must be an instance of.
 * @param value - A value that may be an instance of `constructor`.
 */
export function isInstanceOf<T extends Function>(constructor: T, value: unknown): value is T;
export function isInstanceOf<T extends Function>(constructor: T): (value: unknown) => value is T;

export function isInstanceOf<T extends Function>(constructor: T, value?: unknown) {
  if (value) {
    return value instanceof constructor;
  } else {
    return (value: unknown) => isInstanceOf(constructor, value);
  }
}

/**
 * Returns true if `value` is a JavaScript Promise.
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return value instanceof Promise;
}

/**
 * Returns true if `value` is a plain JavaScript object.
 */
export function isObject<T = Record<string | number | symbol, unknown>>(value: unknown): value is T {
  return value != null && typeof value === "object" && !isArray(value);
}
