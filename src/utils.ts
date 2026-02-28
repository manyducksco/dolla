import { isFunction, isObject, typeOf } from "./typeChecking.js";

export const noOp = () => {};

/**
 * Generates effectively infinite incrementing IDs.
 */
export class IdGenerator {
  static #ALPHABET = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");

  #indices = new Uint8Array(12); // Sufficient for 2^72 IDs
  #asciiBuffer = new Uint8Array(12);
  #currentLength = 1;
  #decoder = new TextDecoder();

  next() {
    let carry = true;

    // Increment the indices (Right-to-Left)
    for (let i = this.#currentLength - 1; i >= 0; i--) {
      if (this.#indices[i] < 63) {
        this.#indices[i]++;
        carry = false;
        break;
      } else {
        this.#indices[i] = 0;
      }
    }

    // Handle overflow (Increase ID length)
    if (carry) {
      if (this.#currentLength >= this.#indices.length) {
        throw new Error("ID Buffer Overflow: Maximum length reached.");
      }
      this.#currentLength++;
      this.#indices.fill(0, 0, this.#currentLength);
      this.#indices[0] = 1; // Start new length at 'B'
    }

    // Map indices to ASCII values
    for (let i = 0; i < this.#currentLength; i++) {
      this.#asciiBuffer[i] = IdGenerator.#ALPHABET[this.#indices[i]];
    }

    // Decode the used portion of the buffer into a single string
    return this.#decoder.decode(this.#asciiBuffer.subarray(0, this.#currentLength));
  }
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
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
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
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a && b && typeof a == "object" && typeof b == "object") {
    if (a.constructor !== b.constructor) return false;

    var length, i, keys;
    if (Array.isArray(a)) {
      length = a.length;
      if (length != b.length) return false;
      for (i = length; i-- !== 0; ) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (i of a.entries()) if (!b.has(i[0])) return false;
      for (i of a.entries()) if (!deepEqual(i[1], b.get(i[0]))) return false;
      return true;
    }

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (i of a.entries()) if (!b.has(i[0])) return false;
      return true;
    }

    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
      length = (a as any).length;
      if (length != (b as any).length) return false;
      for (i = length; i-- !== 0; ) if ((a as any)[i] !== (b as any)[i]) return false;
      return true;
    }

    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) return false;

    for (i = length; i-- !== 0; ) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

    for (i = length; i-- !== 0; ) {
      var key = keys[i];

      if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
  }

  // true if both NaN, false otherwise
  return a !== a && b !== b;
}

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
  if (Array.isArray(value)) {
    return value;
  } else {
    return [value];
  }
}

export function toCamelCase(s: string) {
  return s.replace(/-./g, (x) => x[1].toUpperCase());
}

// export function deepFreeze<T>(obj: T): T {

// }

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
export function getElement(element: string | Element): Element {
  if (typeof element === "string") {
    const match = document.querySelector(element);
    if (!match) {
      throw new Error(`Selector '${element}' did not many any element.`);
    }
    return match;
  } else if (element instanceof Element) {
    return element;
  } else {
    throw new Error("Expected a selector string or DOM element.");
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
