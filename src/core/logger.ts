import { createMatcher, noOp, okhash, type MatcherFunction } from "../utils.js";
import { MaybeGetter, get } from "./reactive.js";

export interface Logger {
  info(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  crash(error: any): void;
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

  onCrash?: (error: unknown) => void;
}

enum LogLevelValue {
  /**
   * Print 'info' level messages and above.
   */
  info = 1,
  /**
   * Print 'log' level messages and above.
   */
  log = 2,
  /**
   * Print 'warn' level messages and above.
   */
  warn = 3,
  /**
   * Print 'error' level messages only.
   */
  error = 4,
  /**
   * Don't print anything.
   */
  silent = 5,
}

export type LogLevel = "info" | "log" | "warn" | "error" | "silent";

const DEFAULT_LOG_LEVEL = "info";

let logLevel: LogLevel = DEFAULT_LOG_LEVEL;
let logFilter: string | RegExp | MatcherFunction = "*,-dolla:*";
let match: MatcherFunction = createMatcher(logFilter);

export function createLogger(name: MaybeGetter<string>, options?: LoggerOptions): Logger {
  const _console = options?.console ?? _getDefaultConsole();

  const bind = (method: LogLevel) => {
    let _name = get(name);
    if (!_canPrint(method) || !match(_name)) {
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
    crash(error) {
      if (options?.onCrash) {
        options.onCrash(error);
      } else {
        throw error;
      }
    },
  };
}

// Log level and filter can be set globally on the window.
// This is helpful when you need to gather info about a bug in the production environment which doesn't usually log anything, for example.
if (typeof window !== "undefined") {
  Object.defineProperties(window, {
    DOLLA_LOG_LEVEL: {
      get: getLogLevel,
      set: setLogLevel,
    },
    DOLLA_LOG_FILTER: {
      get: getLogFilter,
      set: setLogFilter,
    },
  });
}

export function getLogFilter() {
  return logFilter;
}

export function setLogFilter(filter: string | RegExp | ((value: string) => boolean)) {
  logFilter = filter;
  match = createMatcher(filter);
}

export function getLogLevel(): LogLevel {
  return logLevel;
}

export function setLogLevel(level: LogLevel) {
  logLevel = level;
}

function _canPrint(method: LogLevel): boolean {
  const methodValue = LogLevelValue[method];
  const currentValue = LogLevelValue[getLogLevel()];
  return methodValue >= currentValue;
}

function _getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }
  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}
