import { noOp, okhash } from "../utils.js";
import { MaybeGetter, peek } from "./reactive.js";

export interface Logger {
  info(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
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

export type MatcherFunction = (value: string) => boolean;

const DEFAULT_LOG_LEVEL = "info";

let logLevel: LogLevel = DEFAULT_LOG_LEVEL;
let logFilter: string | RegExp | MatcherFunction = "*,-dolla:*";
let match: MatcherFunction = _createMatcher(logFilter);

// Global version counter to invalidate cached logger bindings
let globalConfigVersion = 0;

export function createLogger(name: MaybeGetter<string>, options?: LoggerOptions): Logger {
  const _console = options?.console ?? _getDefaultConsole();

  let cachedVersion = -1;
  let cachedName = "";

  let _info: any = noOp;
  let _log: any = noOp;
  let _warn: any = noOp;
  let _error: any = noOp;

  const updateBindings = () => {
    const currentName = peek(name);

    if (cachedVersion === globalConfigVersion && cachedName === currentName) {
      return;
    }

    cachedVersion = globalConfigVersion;
    cachedName = currentName;

    const isMatch = match(currentName);
    const currentLevelValue = LogLevelValue[logLevel];

    const createBinding = (method: LogLevel, levelValue: number) => {
      if (!isMatch || levelValue < currentLevelValue) return noOp;

      let label = `%c${currentName}`;
      if (options?.tag) {
        if (options.tagName) {
          label += ` %c[${options.tagName}: %c${options.tag}%c]`;
        } else {
          label += ` %c[%c${options.tag}%c]`;
        }
      } else {
        label += `%c%c%c`;
      }

      // bind() to preserve the original call site
      return _console[method].bind(
        _console,
        label,
        `color:${okhash(label)};font-weight:bold`,
        `color:#777`,
        `color:#aaa`,
        `color:#777`,
      );
    };

    _info = createBinding("info", LogLevelValue.info);
    _log = createBinding("log", LogLevelValue.log);
    _warn = createBinding("warn", LogLevelValue.warn);
    _error = createBinding("error", LogLevelValue.error);
  };

  return {
    get info() {
      updateBindings();
      return _info;
    },
    get log() {
      updateBindings();
      return _log;
    },
    get warn() {
      updateBindings();
      return _warn;
    },
    get error() {
      updateBindings();
      return _error;
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
  match = _createMatcher(filter);
  globalConfigVersion++;
}

export function getLogLevel(): LogLevel {
  return logLevel;
}

export function setLogLevel(level: LogLevel) {
  logLevel = level;
  globalConfigVersion++;
}

function _getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }
  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}

function _createMatcher(pattern: string | RegExp | MatcherFunction): MatcherFunction {
  if (pattern instanceof RegExp) {
    return (value: string) => pattern.test(value);
  }

  if (typeof pattern === "function") {
    return pattern;
  }

  const posExact: string[] = [];
  const posPrefix: string[] = [];
  let posAll = false;

  const negExact: string[] = [];
  const negPrefix: string[] = [];
  let negAll = false;

  const parts = pattern.split(",");

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i].trim();
    if (!part) continue;

    // Check for '-'
    const isNeg = part.charCodeAt(0) === 45;
    if (isNeg) part = part.slice(1);

    const exactList = isNeg ? negExact : posExact;
    const prefixList = isNeg ? negPrefix : posPrefix;

    if (part === "*") {
      if (isNeg) negAll = true;
      else posAll = true;
    } else if (part.charCodeAt(part.length - 1) === 42) {
      // Check for '*'
      prefixList.push(part.slice(0, -1));
    } else {
      exactList.push(part);
    }
  }

  // If no specific positives were provided, default to matching everything
  if (!posAll && posExact.length === 0 && posPrefix.length === 0) {
    posAll = true;
  }

  return function (name: string) {
    if (negAll) return false;

    // Check negatives first
    for (let i = 0; i < negExact.length; i++) {
      if (name === negExact[i]) return false;
    }
    for (let i = 0; i < negPrefix.length; i++) {
      if (name.startsWith(negPrefix[i])) return false;
    }

    if (posAll) return true;

    // Check positives
    for (let i = 0; i < posExact.length; i++) {
      if (name === posExact[i]) return true;
    }
    for (let i = 0; i < posPrefix.length; i++) {
      if (name.startsWith(posPrefix[i])) return true;
    }

    return false;
  };
}
