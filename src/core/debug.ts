import { Context } from "./context";
import { MaybeGetter, peek } from "./signals";

export const noOp = () => {};

export type LogLevel = "info" | "log" | "warn" | "error" | "silent";
const LEVELS: Record<string, number> = { trace: 1, info: 1, log: 2, warn: 3, error: 4, silent: 5 };

let logLevel = 1;
let logFilter = (name: string) => !name.startsWith("dolla:");

// 3. Extracted configuration setters (replacing static class methods)
export const setLogLevel = (level: LogLevel) => {
  logLevel = LEVELS[level] || 1;
};
export const setLogFilter = (filter: (name: string) => boolean) => {
  logFilter = filter;
};

const cnsl: any = globalThis.console || {};

export function getDebug(c: Context, ...tags: [string, any][]) {
  return createDebug(() => c.name, ...tags);
}

export function createDebug(name: MaybeGetter<string>, ...tags: [string, any][]) {
  let args: any[];

  const make = (method: string, level: number): ((...args: any[]) => void) => {
    const _name = peek(name);
    if (level < logLevel || !logFilter(_name) || !cnsl[method]) return noOp;

    // Build and cache the console arguments on the first valid log
    if (!args) {
      let p = "%c" + _name;
      let s = [`color:${okhash(_name)};font-weight:bold`];
      for (const [k, v] of tags) {
        p += `%c[${k}: %c${v}%c]`;
        s.push("color:#777", "color:#aaa", "color:#777");
      }
      args = [p, ...s];
    }

    return cnsl[method].bind(cnsl, ...args);
  };

  return {
    get info() {
      return make("info", 1);
    },
    get trace() {
      return make("trace", 1);
    },
    get log() {
      return make("log", 2);
    },
    get warn() {
      return make("warn", 3);
    },
    get error() {
      return make("error", 4);
    },
  };
}

/* ----- HELPERS----- */

/**
 * Takes any string and returns an OKLCH color.
 */
function okhash(value: string) {
  let hue = 0;
  for (let i = 0; i < value.length; i++) {
    hue = (hue + value.charCodeAt(i) * 10) % 360;
  }
  return `oklch(0.68 0.15 ${hue}deg)`;
}
