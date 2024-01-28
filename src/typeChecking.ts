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
  // These values are more specific ones that `Type.of` can return.
  | "null"
  | "array"
  | "class"
  | "promise"
  | "NaN";

/**
 * Represents an object that can be called with `new` to produce a T.
 */
type Factory<T> = { new (): T };

/**
 * Extends `typeof` operator with more specific and useful type distinctions.
 */
export function typeOf(value: unknown): TypeNames {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  const type = typeof value;

  switch (type) {
    case "number":
      if (isNaN(value as any)) {
        return "NaN";
      }
      return "number";
    case "function":
      if (isClass(value)) {
        return "class";
      }

      return type;
    case "object":
      if (isArray(value)) {
        return "array";
      }

      if (isPromise(value)) {
        return "promise";
      }

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
      formatError(condition, errorMessage || "Failed assertion. Value is not truthy. Got type: %t, value: %v")
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
 * Returns a function that takes a `value` and ensures that it is an array for which `check` returns true for every item.
 *
 * @param check - Function to check items against.
 */
export function isArrayOf<T>(check: (item: unknown) => boolean): (value: unknown) => value is T[];

/**
 * Returns true when `value` is an array and `check` returns true for every item.
 *
 * @param check - Function to check items against.
 * @param value - A possible array.
 */
export function isArrayOf<T>(check: (item: unknown) => boolean, value: unknown): value is T[];

export function isArrayOf<T>(...args: unknown[]) {
  const check = args[0] as (item: unknown) => boolean;

  const test = (value: unknown): value is T[] => {
    return isArray(value) && value.every((item) => check(item));
  };

  if (args.length < 2) {
    return test;
  } else {
    return test(args[1]);
  }
}

/**
 * Returns a function that takes a `value` and throws a TypeError unless it is an array for which `check` returns true for every item.
 *
 * @param check - Function to check items against.
 */
export function assertArrayOf<T>(check: (item: unknown) => boolean): (value: unknown) => value is T[];

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
  errorMessage?: string
): value is T[];

export function assertArrayOf<T>(...args: unknown[]) {
  const check = args[0] as (item: unknown) => boolean;
  const message = isString(args[2]) ? args[2] : "Expected an array of valid items. Got type: %t, value: %v";

  const test = (value: unknown): value is T[] => {
    if (isArray(value) && value.every((item) => check(item))) {
      return true;
    }

    throw new TypeError(formatError(value, message));
  };

  if (args.length < 2) {
    return test;
  } else {
    return test(args[1]);
  }
}

/**
 * Returns true if `value` is equal to `true` or `false`.
 */
export function isBoolean(value: unknown): value is boolean {
  return value === true || value === false;
}

/**
 * Throws a TypeError unless `value` is equal to `true` or `false`.
 */
export function assertBoolean(value: unknown, errorMessage?: string): value is boolean {
  if (isBoolean(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a boolean. Got type: %t, value: %v"));
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
  return typeof value === "function" && !isClass(value);
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
 * Returns true if `value` implements the Promise protocol.
 * This matches true instances of Promise as well as any object that
 * implements `next`, `catch` and `finally` methods.
 *
 * To strictly match instances of Promise, use `isInstanceOf(Promise)`.
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  if (value == null) return false;

  const obj = value as any;

  return obj instanceof Promise || (isFunction(obj.then) && isFunction(obj.catch) && isFunction(obj.finally));
}

/**
 * Throws a TypeError unless `value` implements the Promise protocol.
 * This matches true instances of Promise as well as any object that
 * implements `next`, `catch` and `finally` methods.
 *
 * To strictly allow only instances of Promise, use `Type.assertInstanceOf(Promise)`.
 */
export function assertPromise<T = unknown>(value: unknown, errorMessage?: string): value is Promise<T> {
  if (isPromise(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a promise. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` is a class.
 */
export function isClass(value: unknown): value is { new (): unknown } {
  return typeof value === "function" && /^\s*class\s+/.test(value.toString());
}

/**
 * Throws a TypeError unless `value` is a class.
 */
export function assertClass(value: unknown, errorMessage?: string): value is { new (): unknown } {
  if (isClass(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a class. Got type: %t, value: %v"));
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
 * Returns true if `value` is a Map.
 */
export function isMap<K = unknown, V = unknown>(value: any): value is Map<K, V> {
  return value instanceof Map;
}

/**
 * Throws a TypeError unless `value` is a Map.
 */
export function assertMap<K = unknown, V = unknown>(value: any, errorMessage?: string): value is Map<K, V> {
  if (isMap(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a Map. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` is a Set.
 */
export function isSet<T = unknown>(value: any): value is Set<T> {
  return value instanceof Set;
}

/**
 * Throws a TypeError if `value` is not a Set.
 */
export function assertSet<T = unknown>(value: any, errorMessage?: string): value is Set<T> {
  if (isSet(value)) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected a Set. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` implements the Iterable protocol.
 */
export function isIterable<T>(value: any): value is Iterable<T> {
  if (value == null) {
    return false;
  }

  // Must have a [Symbol.iterator] function that returns an iterator.
  if (!isFunction(value[Symbol.iterator])) {
    return false;
  }

  const iterator = value[Symbol.iterator]();

  // Iterator must implement the iterator protocol.
  if (!isFunction(iterator.next)) {
    return false;
  }

  // We have to assume next() returns the correct object.
  // We can't call it to make sure because we don't want to cause side effects.
  return true;
}

/**
 * Throws a TypeError unless `value` implements the Iterable protocol.
 */
export function assertIterable<T>(value: any, errorMessage?: string): value is Iterable<T> {
  if (isIterable(value)) {
    return true;
  }

  throw new TypeError(
    formatError(
      value,
      errorMessage ?? "Expected an object that implements the iterable protocol. Got type: %t, value: %v"
    )
  );
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
 * Returns true if `value` is equal to `null`.
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Throws a TypeError unless `value` is equal to `null`.
 */
export function assertNull(value: unknown, errorMessage?: string): value is null {
  if (value === null) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected null. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` is equal to `undefined`.
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * Throws a TypeError unless `value` is equal to `undefined`.
 */
export function assertUndefined(value: unknown, errorMessage?: string): value is undefined {
  if (value === undefined) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected undefined. Got type: %t, value: %v"));
}

/**
 * Returns true if `value` is equal to `null` or `undefined`.
 */
export function isEmpty(value: unknown): value is void {
  return value === null || value === undefined;
}

/**
 * Throws a TypeError unless `value` is equal to `null` or `undefined`.
 */
export function assertEmpty(value: unknown, errorMessage?: string): value is void {
  if (value == null) {
    return true;
  }

  throw new TypeError(formatError(value, errorMessage ?? "Expected null or undefined. Got type: %t, value: %v"));
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
