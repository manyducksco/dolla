export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*=============================*\
||         ID Generator        ||
\*=============================*/

let lastId = 0;
export function uniqueId() {
  return (lastId++).toString(36);
}

/*=============================*\
||         Object Utils        ||
\*=============================*/

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
||        Type Checking        ||
\*=============================*/

/**
 * Throws a TypeError unless `condition` is truthy.
 *
 * @param value - Value whose truthiness is in question.
 * @param errorMessage - Optional message for the thrown TypeError.
 */
export function assert<T = any>(value: T, errorMessage: string): asserts value is NonNullable<T> {
  if (!value) throw new TypeError(errorMessage);
}

/**
 * Returns true if `value` is an array.
 */
export function isArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value);
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
