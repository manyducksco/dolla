import { isString } from "../typeChecking.js";
import type { Env } from "../types.js";
import { createMatcher, noOp, okhash, type MatcherFunction } from "../utils.js";
import { getEnv } from "./env.js";
import { get, untracked, type MaybeSignal } from "./signals.js";

export interface LogLevels {
  info: boolean | Env;
  log: boolean | Env;
  warn: boolean | Env;
  error: boolean | Env;
}

export interface Logger {
  info(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  crash(error: Error): Error;
}

export interface LoggerOptions {
  /**
   * Tag value to print with logs.
   */
  tag?: string;

  /**
   * Label for tag value. Will be printed without a label if not specified.
   */
  tagName?: string;

  /**
   * Console object to use for logging (mostly for testing). Uses window.console by default.
   */
  console?: any;
}

export interface LoggerErrorProps {
  error: Error;
  loggerName: string;
  tag?: string;
  tagName?: string;
}

let levels: LogLevels = {
  info: "development",
  log: "development",
  warn: "development",
  error: true,
};
let match: MatcherFunction = createMatcher("*,-dolla.*");
let crashListeners: ((context: LoggerErrorProps) => void)[] = [];
let isCrashed = false;

export function onLoggerCrash(listener: (context: LoggerErrorProps) => void) {
  crashListeners.push(listener);

  return function cancel() {
    crashListeners.splice(crashListeners.indexOf(listener), 1);
  };
}

export function createLogger(name: MaybeSignal<string>, options?: LoggerOptions): Logger {
  const _console = options?.console ?? _getDefaultConsole();

  const bind = (method: keyof LogLevels) => {
    let _name = untracked(name);
    if (levels[method] === false || (isString(levels[method]) && levels[method] !== getEnv()) || !match(_name)) {
      return noOp;
    } else {
      let label = `%c${_name}`;
      if (options?.tag) {
        if (options.tagName) {
          label += ` %c[${options.tagName}: %c${options.tag}%c]`;
        } else {
          label += ` %c[%c${options.tag}%c]`;
        }
      } else {
        label += `%c%c%c`;
      }
      return _console[method].bind(
        _console,
        label,
        `color:${okhash(label)};font-weight:bold`,
        `color:#777`,
        `color:#aaa`,
        `color:#777`,
      );
    }
  };

  return {
    get info() {
      return bind("info");
    },
    get log() {
      return bind("log");
    },
    get warn() {
      return bind("warn");
    },
    get error() {
      return bind("error");
    },
    crash(error: Error) {
      if (!isCrashed) {
        isCrashed = true;
        const ctx: LoggerErrorProps = {
          error,
          loggerName: get(name),
          tag: options?.tag,
          tagName: options?.tagName,
        };

        for (const listener of crashListeners) {
          listener(ctx);
        }

        throw error;
      }

      return error;
    },
  };
}

export function setLogFilter(filter: string | RegExp) {
  match = createMatcher(filter);
}

export function setLogLevels(options: Partial<LogLevels>) {
  for (const key in options) {
    const value = options[key as keyof LogLevels];
    if (value) {
      levels[key as keyof LogLevels] = value;
    }
  }
}

function _getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }
  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}
