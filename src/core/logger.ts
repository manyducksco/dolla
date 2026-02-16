import { createMatcher, noOp, okhash, type MatcherFunction } from "../utils.js";
import { getEnv } from "./env.js";
import { Getter, MaybeGetter, read, type MaybeReadable } from "./signal.js";

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

export interface LoggerCrashProps {
  error: Error;
  loggerName: string;
  tag?: string;
  tagName?: string;
}

enum LogLevelValue {
  /**
   * Print 'info' level messages and above.
   */
  info = 1,
  /**
   * Print 'log' (standard) level messages and above.
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

/**
 * Log level defaults to Error in production mode and Info in development mode.
 */
const DEFAULT_LOG_LEVEL = Symbol();

let logLevel: LogLevel | Symbol = DEFAULT_LOG_LEVEL;
let logFilter: string | RegExp | MatcherFunction = "*,-dolla.*";
let match: MatcherFunction = createMatcher(logFilter);
let crashListeners: ((context: LoggerCrashProps) => void)[] = [];
let isCrashed = false;

/**
 * Listen for logged crashes.
 */
export function onLoggerCrash(listener: (context: LoggerCrashProps) => void) {
  crashListeners.push(listener);

  return function cancel() {
    crashListeners.splice(crashListeners.indexOf(listener), 1);
  };
}

export function createLogger(name: MaybeGetter<string>, options?: LoggerOptions): Logger {
  const _console = options?.console ?? _getDefaultConsole();

  const bind = (method: LogLevel) => {
    let _name = read(name);
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
    crash(error: Error) {
      if (!isCrashed) {
        isCrashed = true;
        const ctx: LoggerCrashProps = {
          error,
          loggerName: read(name),
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

export function getLogFilter() {
  return logFilter;
}

export function setLogFilter(filter: string | RegExp | ((value: string) => boolean)) {
  logFilter = filter;
  match = createMatcher(filter);
}

export function getLogLevel(): LogLevel {
  if (logLevel === DEFAULT_LOG_LEVEL) {
    if (getEnv() === "production") {
      return "error";
    } else {
      return "info";
    }
  } else {
    return logLevel as LogLevel;
  }
}

export function setLogLevel(level: LogLevel | null) {
  if (level === null) {
    logLevel = DEFAULT_LOG_LEVEL;
  } else {
    logLevel = level;
  }
}

function _canPrint(method: LogLevel): boolean {
  const methodValue = LogLevelValue[method];
  const currentValue = LogLevelValue[getLogLevel()];

  return methodValue > currentValue;
}

function _getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }
  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}
