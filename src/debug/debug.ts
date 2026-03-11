import { isFunction, noOp, okhash } from "../utils.js";
import { Context } from "../core/context.js";

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

export type MatcherFn = (value: string) => boolean;

const DEFAULT_LOG_LEVEL = "info";

let logLevel: LogLevel = DEFAULT_LOG_LEVEL;
let logFilter: string | RegExp | MatcherFn = "*,-dolla:*";
let match: MatcherFn = _createMatcher(logFilter);

let _console: any = _getDefaultConsole();

export interface DebugOptions {
  tags?: [string, any][];
}

export class Debug {
  constructor(
    private name: string,
    private tags: [string, any][] = [],
  ) {}

  get info(): (...args: any[]) => void {
    if (LogLevelValue.info < LogLevelValue[logLevel] || !match(this.name)) return noOp;
    const [label, styles] = this.#getLabel();
    return _console.info.bind(_console, label, ...styles);
  }
  get log(): (...args: any[]) => void {
    if (LogLevelValue.log < LogLevelValue[logLevel] || !match(this.name)) return noOp;
    const [label, styles] = this.#getLabel();
    return _console.log.bind(_console, label, ...styles);
  }
  get warn(): (...args: any[]) => void {
    if (LogLevelValue.warn < LogLevelValue[logLevel] || !match(this.name)) return noOp;
    const [label, styles] = this.#getLabel();
    return _console.warn.bind(_console, label, ...styles);
  }
  get error(): (...args: any[]) => void {
    if (LogLevelValue.error < LogLevelValue[logLevel] || !match(this.name)) return noOp;
    const [label, styles] = this.#getLabel();
    return _console.error.bind(_console, label, ...styles);
  }
  get trace(): (...args: any[]) => void {
    if (LogLevelValue.info < LogLevelValue[logLevel] || !match(this.name)) return noOp;
    const [label, styles] = this.#getLabel();
    return _console.trace.bind(_console, label, ...styles);
  }

  #getLabel() {
    let parts: string[] = ["%c" + this.name];
    let styles: string[] = [`color:${okhash(this.name)};font-weight:bold`];

    if (this.tags.length) {
      for (const [name, value] of this.tags) {
        parts.push("%c[" + name + ": ");
        styles.push("color:#777");

        parts.push("%c" + value);
        styles.push("color:#aaa");

        parts.push("%c]");
        styles.push("color:#777");
      }
    }

    return [parts.join(""), styles];
  }

  static getLevel() {
    return logLevel;
  }

  static setLevel(level: LogLevel) {
    logLevel = level;
  }

  static getFilter() {
    return logFilter;
  }

  static setFilter(filter: string | RegExp | ((value: string) => boolean)) {
    logFilter = filter;
    match = _createMatcher(filter);
  }
}

new Debug("name", [["ctx", 13]]);

// Log level and filter can be set globally on the window.
// This is helpful when you need to gather info about a bug in the production environment which doesn't usually log anything, for example.
if (typeof window !== "undefined") {
  Object.defineProperties(window, {
    DOLLA_LOG_LEVEL: {
      get: Debug.getLevel,
      set: Debug.setLevel,
    },
    DOLLA_LOG_FILTER: {
      get: Debug.getFilter,
      set: Debug.setFilter,
    },
  });
}

function _getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }
  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}

function _createMatcher(pattern: string | RegExp | MatcherFn): MatcherFn {
  if (pattern instanceof RegExp) {
    return (value: string) => pattern.test(value);
  }

  if (isFunction<MatcherFn>(pattern)) {
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
