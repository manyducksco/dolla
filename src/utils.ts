import colorHash from "simple-color-hash";
import { isFunction, isObject, typeOf } from "./typeChecking.js";
import _deepEqual from "fast-deep-equal/es6";

export const noOp = () => {};

// Guarantee unique ID by incrementing a global counter.
let idCounter = 1;
export function getUniqueId() {
  idCounter = (idCounter % Number.MAX_SAFE_INTEGER) + 1;
  return idCounter.toString(36) + Date.now().toString(36);
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
  if (Object.is(a, b)) return true;

  // Must be same type
  const t = typeOf(a);
  if (t !== typeOf(b)) {
    return false;
  }

  switch (t) {
    case "object":
      // Objects must have same number of keys with strict equal values
      let size = 0;
      for (const key in a) {
        if (a[key] !== b[key]) return false;
        size++;
      }
      return Object.keys(b).length === size;
    case "array":
      // Arrays must be the same length with strict equal values
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    case "map":
      if (a.size !== b.size) return false;
      for (const key of a.keys()) {
        if (a[key] !== b[key]) return false;
      }
      return true;
    case "set":
      if (isFunction(a.symmetricDifference)) {
        return a.symmetricDifference(b).size === 0;
      } else {
        for (const key of a.keys()) {
          if (a[key] !== b.get(key)) return false;
        }
        return true;
      }
  }

  return false;
}

/**
 * Equality check that passes if two objects have equal values, even if they are not the same object.
 */
export const deepEqual = _deepEqual;

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
  const process = (object: Record<any, any>) => {
    const newObject: Record<any, any> = {};

    for (const key in object) {
      if (!keys.includes(key)) {
        newObject[key] = object[key];
      }
    }

    return newObject;
  };

  if (object == null) {
    return process;
  }

  return process(object);
}

/*=============================*\
||         Object Utils        ||
\*=============================*/

export function colorFromString(value: string) {
  return colorHash({
    str: value,
    sat: { min: 0.35, max: 0.55 },
    light: { min: 0.6, max: 0.6 },
  });
}

export type MatcherFunction = (value: string) => boolean;

/**
 * Parses a filter string into a matcher function.
 *
 * @param pattern - A string or regular expression that specifies a pattern for names of loggers whose messages you want to display.
 */
export function createMatcher(pattern: string | RegExp): MatcherFunction {
  if (pattern instanceof RegExp) {
    return (value: string) => pattern.test(value);
  }

  const matchers: Record<"positive" | "negative", MatcherFunction[]> = {
    positive: [],
    negative: [],
  };

  const parts = pattern
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "");

  for (let part of parts) {
    let section: "positive" | "negative" = "positive";

    if (part.startsWith("-")) {
      section = "negative";
      part = part.slice(1);
    }

    if (part === "*") {
      matchers[section].push(function () {
        return true;
      });
    } else if (part.endsWith("*")) {
      matchers[section].push(function (value) {
        return value.startsWith(part.slice(0, part.length - 1));
      });
    } else {
      matchers[section].push(function (value) {
        return value === part;
      });
    }
  }

  return function (name: string) {
    const { positive, negative } = matchers;

    // Matching any negative matcher disqualifies.
    if (negative.some((fn) => fn(name))) {
      return false;
    }

    // Matching at least one positive matcher is required if any are specified.
    if (positive.length > 0 && !positive.some((fn) => fn(name))) {
      return false;
    }

    return true;
  };
}
