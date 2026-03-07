type TypeNames =
  // These values can be returned by `typeof`.
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "symbol"
  | "undefined"
  | "object"
  | "function"
  // These values are more specific ones that the `typeOf` function can return.
  | "null"
  | "array"
  | "class"
  | "promise"
  | "map"
  | "set"
  | "NaN";

/**
 * Extends `typeof` operator with more specific and useful type distinctions.
 */
export function typeOf(value: any): TypeNames {
  const type = typeof value;
  switch (type) {
    case "undefined":
      return type;
    case "number":
      if (isNaN(value as any)) return "NaN";
      return type;
    case "function":
      if (/^\s*class\s+/.test(value.toString())) return "class";
      return type;
    case "object":
      if (value === null) return "null";
      if (value instanceof Promise) return "promise";
      if (value instanceof Map) return "map";
      if (value instanceof Set) return "set";
      if (Array.isArray(value)) return "array";
      return type;
    default:
      return type;
  }
}

/**
 * Throws a TypeError unless `condition` is truthy.
 *
 * @param condition - Value whose truthiness is in question.
 * @param errorMessage - Optional message for the thrown TypeError.
 */
export function assert(condition: any, errorMessage?: string): void {
  if (!condition) {
    throw new TypeError(
      formatError(condition, errorMessage || "Failed assertion. Value is not truthy. Got type: %t, value: %v"),
    );
  }
}

export function assertType<T>(
  test: (value: unknown) => value is T,
  value: unknown,
  message = "Unexpected type. Got type: %t, value: %v",
): value is T {
  if (test(value)) {
    return true;
  }
  throw new TypeError(formatError(value, message));
}

export function assertTypeOf<T>(
  value: unknown,
  test: (value: unknown) => value is T,
  message = "Unexpected type. Got type: %t, value: %v",
): value is T {
  if (test(value)) {
    return true;
  }
  throw new TypeError(formatError(value, message));
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

export function isArrayOf<T>(check: (item: unknown) => boolean, value: unknown): value is T[] {
  return isArray(value) && value.every((item) => check(item));
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
  return typeOf(value) === "function";
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

export function isInstanceOf<T extends Function>(...args: unknown[]) {
  const constructor = args[0] as T;

  const test = (value: unknown): value is T => {
    return value instanceof constructor;
  };

  if (args.length < 2) {
    return test;
  } else {
    return test(args[1]);
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

/**
 * Replaces `%t` and `%v` placeholders in a message with real values.
 */
function formatError(value: unknown, message: string) {
  const typeName = typeOf(value);

  // TODO: Pretty format value as string based on type.
  const valueString = value?.toString?.() || String(value);

  return message.replaceAll("%t", typeName).replaceAll("%v", valueString);
}
