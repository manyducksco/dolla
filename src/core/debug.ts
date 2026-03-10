import { noOp, okhash } from "../utils.js";
import { Context, getActiveContext } from "./context.js";

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

let _console: any = _getDefaultConsole();

function bindMethod(getContext: () => Context | undefined, method: LogLevel) {
  if (LogLevelValue[method] < LogLevelValue[logLevel]) return noOp;

  const context = getContext();
  if (context && !match(context.getName())) return noOp;

  if (context) {
    const label = `%c${context.getName()} %c[ctx: %c${context.id}%c]`;
    // bind() to preserve the original call site
    return _console[method].bind(
      _console,
      label,
      `color:${okhash(label)};font-weight:bold`,
      `color:#777`,
      `color:#aaa`,
      `color:#777`,
    );
  } else {
    return _console[method].bind(_console);
  }
}

export class Debug {
  constructor(private getContext = () => getActiveContext()) {}

  /**
   * Returns an instance of Debug bound to the context this function was called in.
   */
  bind(): Debug;

  /**
   * Returns an instance of Debug bound to this specific `context`.
   */
  bind(context: Context): Debug;

  bind(context = getActiveContext()) {
    return new Debug(() => context);
  }

  get info(): (...args: any[]) => void {
    return bindMethod(this.getContext, "info");
  }
  get log(): (...args: any[]) => void {
    return bindMethod(this.getContext, "log");
  }
  get warn(): (...args: any[]) => void {
    return bindMethod(this.getContext, "warn");
  }
  get error(): (...args: any[]) => void {
    return bindMethod(this.getContext, "error");
  }

  getLevel() {
    return logLevel;
  }

  setLevel(level: LogLevel) {
    logLevel = level;
  }

  getFilter() {
    return logFilter;
  }

  setFilter(filter: string | RegExp | ((value: string) => boolean)) {
    logFilter = filter;
    match = _createMatcher(filter);
  }
}

export const debug = new Debug();

// Log level and filter can be set globally on the window.
// This is helpful when you need to gather info about a bug in the production environment which doesn't usually log anything, for example.
if (typeof window !== "undefined") {
  Object.defineProperties(window, {
    DOLLA_LOG_LEVEL: {
      get: debug.getLevel,
      set: debug.setLevel,
    },
    DOLLA_LOG_FILTER: {
      get: debug.getFilter,
      set: debug.setFilter,
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
