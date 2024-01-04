import { isObject } from "@borf/bedrock";

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

  if (isPlainObject(one) && isPlainObject(two)) {
    const keysOne = Object.keys(one);
    const keysTwo = Object.keys(two);

    if (keysOne.length !== keysTwo.length) {
      return false;
    }

    for (const key in one) {
      if (!deepEqual(one[key], two[key])) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(one) && Array.isArray(two)) {
    if (one.length !== two.length) {
      return false;
    }

    for (const index in one) {
      if (!deepEqual(one[index], two[index])) {
        return false;
      }
    }

    return true;
  }

  return one === two;
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
