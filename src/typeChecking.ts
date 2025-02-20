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

/**
 * Returns true if `value` is an array.
 */
export function isArray(value: unknown): value is Array<unknown> {
  return Array.isArray(value);
}

/**
 * Throws an error if `value` is not an array.
 */
export function assertArray(value: unknown, errorMessage?: string): value is Array<unknown> {
  if (isArray(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage || "Expected array. Got type: %t, value: %v"));
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
 * Throws a TypeError unless `value` is an array and `check` returns true for every item.
 *
 * @param check - Function to check items against.
 * @param value - A possible array.
 * @param errorMessage - A custom error message.
 */
export function assertArrayOf<T>(
  check: (item: unknown) => boolean,
  value: unknown,
  errorMessage?: string,
): value is T[] {
  if (isArrayOf(check, value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected an array of valid items. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Throws a TypeError unless `value` is a string.
 */
export function assertString(value: unknown, errorMessage?: string): value is string {
  if (isString(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a string. Got type: %t, value: %v"));
}

// TODO: More specific validation for common types of strings? Email address, URL, UUID, etc?

/**
 * Returns true if `value` is a function (but not a class).
 */
export function isFunction<T = (...args: unknown[]) => unknown>(value: unknown): value is T {
  return typeOf(value) === "function";
}

/**
 * Throws a TypeError unless `value` is a function.
 */
export function assertFunction<T = (...args: unknown[]) => unknown>(value: unknown, errorMessage?: string): value is T {
  if (isFunction(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a function. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` is a number.
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Throws a TypeError unless `value` is a number.
 */
export function assertNumber(value: unknown, errorMessage?: string): value is number {
  if (isNumber(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a number. Got type: %t, value: %v"));
}

/**
 * Returns a function that takes a `value` and returns true if `value` is an instance of `constructor`.
 *
 * @param constructor - The constructor a value must be an instance of to match.
 */
export function isInstanceOf<T extends Function>(constructor: T): (value: unknown) => value is T;

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
 * Returns a function that takes a `value` and throws a TypeError unless `value` is an instance of `constructor`.
 *
 * @param constructor - The constructor a value must be an instance of to match.
 */
export function assertInstanceOf<T extends Function>(constructor: T): (value: unknown) => value is T;

/**
 * Throws a TypeError unless `value` is an instance of `constructor`.
 *
 * @param constructor - The constructor `value` must be an instance of.
 * @param value - A value that may be an instance of `constructor`.
 * @param errorMessage - A custom error message for when the assertion fails.
 */
export function assertInstanceOf<T extends Function>(constructor: T, value: unknown, errorMessage?: string): value is T;

export function assertInstanceOf<T extends Function>(...args: unknown[]) {
  const constructor = args[0] as T;
  const errorMessage = isString(args[2])
    ? args[2]
    : `Expected instance of ${constructor.name}. Got type: %t, value: %v`;

  const test = (value: unknown): value is T => {
    if (value instanceof constructor) {
      return true;
    }

    throw new TypeError(formatError(value, errorMessage));
  };

  if (args.length < 2) {
    return test;
  } else {
    return test(args[1]);
  }
}

/**
 * Returns true if `value` is a plain JavaScript object.
 */
export function isObject(value: unknown): value is Record<string | number | symbol, unknown> {
  return value != null && typeof value === "object" && !isArray(value);
}

/**
 * Throws a TypeError unless `value` is a plain JavaScript object.
 */
export function assertObject(value: unknown, errorMessage?: string): value is object {
  if (isObject(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected an object. Got type: %t, value: %v"));
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
