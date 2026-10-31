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
  // Arrow functions, methods, async and bound functions have no `prototype`, so
  // they can't be classes. That covers almost every getter, letting hot signal
  // paths skip the costly class check.
  return typeof value === "function" && (value.prototype === undefined || !isClass(value));
}

function isClass(value: unknown): boolean {
  return typeof value === "function" && value.toString().startsWith("class ");
}

/**
 * Returns true if `value` is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Returns true if `value` is promise-like (has a callable `then` method).
 */
export function isThenable<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    value != null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as any).then === "function"
  );
}

/**
 * Returns true if `value` is a plain JavaScript object.
 */
export function isObject<T = Record<string | number | symbol, unknown>>(value: unknown): value is T {
  return value != null && typeof value === "object" && !isArray(value);
}
