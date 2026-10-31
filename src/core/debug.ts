import type { Context } from "./context";
import { peek, type MaybeGetter } from "./signals";

const noOp = () => {};

export type LogLevel = "trace" | "info" | "log" | "warn" | "error" | "silent";
const LEVELS: Record<string, number> = { trace: 1, info: 1, log: 2, warn: 3, error: 4, silent: 5 };

let logLevel = 1;
let logFilter = (name: string) => !name.startsWith("dolla:");

export const setLogLevel = (level: LogLevel) => {
  logLevel = LEVELS[level] || 1;
};
export const setLogFilter = (filter: (name: string) => boolean) => {
  logFilter = filter;
};

const cnsl: any = console;

export function getDebug(c: Context, ...tags: [string, any][]) {
  return createDebug(() => c.name ?? "", ...tags);
}

export function createDebug(name: MaybeGetter<string>, ...tags: [string, any][]) {
  const make = (method: string, level: number): ((...args: any[]) => void) => {
    const _name = peek(name);
    if (level < logLevel || !logFilter(_name) || !cnsl[method]) return noOp;

    let p = "%c" + _name;
    const s = [`color:${okhash(_name)};font-weight:bold`];
    for (const [k, v] of tags) {
      p += `%c[${k}: %c${v}%c]`;
      s.push("color:#777", "color:#aaa", "color:#777");
    }

    return cnsl[method].bind(cnsl, p, ...s);
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
