import colorHash from "simple-color-hash";
import { isState } from "./state.js";
import { isObject } from "./typeChecking.js";
import fastDeepEqual from "fast-deep-equal";

export const noOp = () => {};

function isPlainObject<T = { [name: string]: any }>(value: any): value is T {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.getPrototypeOf({})
  );
}

export function deepEqual(one: any, two: any) {
  if (one === two) {
    return true;
  }

  if (isState(one) || isState(two)) {
    return false;
  }

  return fastDeepEqual(one, two);

  // if (isPlainObject(one) && isPlainObject(two)) {
  //   const keysOne = Object.keys(one);
  //   const keysTwo = Object.keys(two);

  //   if (keysOne.length !== keysTwo.length) {
  //     return false;
  //   }

  //   for (const key in one) {
  //     if (!deepEqual(one[key], two[key])) {
  //       return false;
  //     }
  //   }

  //   return true;
  // }

  // if (Array.isArray(one) && Array.isArray(two)) {
  //   if (one.length !== two.length) {
  //     return false;
  //   }

  //   for (const index in one) {
  //     if (!deepEqual(one[index], two[index])) {
  //       return false;
  //     }
  //   }

  //   return true;
  // }

  // return one === two;
}

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

export function getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }

  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}

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
