import { isString } from "../typeChecking";
import { createMatcher, noOp, okhash, type MatcherFunction } from "../utils";
import { getEnv, type Env } from "./env";
import { get, type MaybeSignal } from "./signals";

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
  crash(error: Error): void;
}

export interface LoggerOptions {
  /**
   * Unique ID to print with logs. Makes it easier to track down messages from specific view instances.
   */
  uid?: string;

  /**
   * Console object to use for logging (mostly for testing). Uses window.console by default.
   */
  console?: any;
}

export interface LoggerErrorContext {
  error: Error;
  loggerName: string;
  uid?: string;
}

let levels: LogLevels = {
  info: "development",
  log: "development",
  warn: "development",
  error: true,
};
let match: MatcherFunction = createMatcher("*,-Dolla.*");
let crashListeners: ((context: LoggerErrorContext) => void)[] = [];

export function onLoggerCrash(listener: (context: LoggerErrorContext) => void) {
  crashListeners.push(listener);

  return function cancel() {
    crashListeners.splice(crashListeners.indexOf(listener), 1);
  };
}

export function createLogger(name: MaybeSignal<string>, options?: LoggerOptions): Logger {
  const _console = options?.console ?? _getDefaultConsole();

  const bind = (method: keyof LogLevels) => {
    let _name = get(name);
    if (levels[method] === false || (isString(levels[method]) && levels[method] !== getEnv()) || !match(_name)) {
      return noOp;
    } else {
      let label = `%c${_name}`;
      if (options?.uid) {
        label += ` %c[uid: %c${options.uid}%c]`;
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
      const ctx: LoggerErrorContext = {
        error,
        loggerName: get(name),
        uid: options?.uid,
      };

      for (const listener of crashListeners) {
        listener(ctx);
      }
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
