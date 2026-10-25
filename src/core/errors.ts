import type { Context } from "./context.js";
import type { ReactiveNode } from "./signals.js";
import { describeNode, reactiveScopeStack, type ReactiveScopeInfo } from "./signal-debug.js";
import { ERROR_HANDLER } from "./symbols.js";

export type { ReactiveScopeInfo };

export type ErrorPhase =
  | "effect"
  | "effect-cleanup"
  | "computed"
  | "setter"
  | "update"
  | "mount"
  | "unmount"
  | "handler";

export interface SignalErrorInfo {
  phase: ErrorPhase;
  context?: Context;
  node?: ReactiveNode;
  label?: string;
  scopes?: readonly ReactiveScopeInfo[];
  triggerFrames?: readonly string[];
}

export type SignalErrorHandler = (error: SignalError) => void;

const SIGNAL_ERROR_BRAND = Symbol.for("dolla.SignalError");

const INTERNAL_FRAME =
  /(?:^|[/\\])(?:core|dist)[/\\](?:signals|errors|signal-debug|scheduler|root|context)(?:-[\w-]+)?\.(?:ts|js)(?::\d+:\d+)?/;
const TRIGGER_BOUNDARY = /\bat (?:flush|createEffect|withReactiveScope)\b/;

/**
 * A structured wrapper around any error raised by the reactive runtime.
 *
 * The original throw value is always available in `cause`. `stack` points at
 * the original throw site, while `message` includes the reactive context and
 * the update that triggered the effect.
 */
export class SignalError extends Error {
  override readonly name = "SignalError";

  readonly phase: ErrorPhase;
  readonly contextName?: string;
  readonly effect?: { type: "effect" | "composed"; name: string };
  readonly label?: string;
  readonly scopes: readonly ReactiveScopeInfo[];
  readonly trigger: readonly string[];
  readonly original: unknown;

  constructor(cause: Error, original: unknown, info: SignalErrorInfo) {
    const scopes = info.scopes ?? collectScopes();
    const trigger = info.triggerFrames ?? extractTriggerFrames(cause.stack);

    super(formatMessage(cause, info, scopes, trigger), { cause });

    this.phase = info.phase;
    this.contextName = info.context?.name;
    this.effect = info.node ? describeNode(info.node) : undefined;
    this.label = info.label;
    this.scopes = scopes;
    this.trigger = trigger;
    this.original = original;

    Object.defineProperty(this, SIGNAL_ERROR_BRAND, {
      value: true,
      enumerable: false,
    });

    if (cause.stack) {
      const newline = cause.stack.indexOf("\n");
      const frames = newline >= 0 ? cause.stack.slice(newline) : "";
      this.stack = `${this.name}: ${this.message}${frames}`;
    }
  }
}

export function isSignalError(value: unknown): value is SignalError {
  if (value instanceof SignalError) return true;
  return (
    typeof value === "object" &&
    value !== null &&
    (value as any)[SIGNAL_ERROR_BRAND] === true
  );
}

export function toSignalError(error: unknown, info: SignalErrorInfo): SignalError {
  if (isSignalError(error)) return error;

  const cause =
    error instanceof Error ? error : new Error(String(error), { cause: error });

  return new SignalError(cause, error, {
    ...info,
    scopes: info.scopes ?? collectScopes(),
    triggerFrames: info.triggerFrames ?? extractTriggerFrames(cause.stack),
  });
}

let globalHandler: SignalErrorHandler | null = null;

/**
 * Installs a fallback handler for environments without a root context.
 * Exported from `@manyducks.co/dolla/internals` for tests and standalone use.
 */
export function setErrorHandler(handler: SignalErrorHandler | null): void {
  globalHandler = handler ?? null;
}

/**
 * Reports an error through the nearest root `onError` handler, then the
 * internals-only global handler, then the default reporter.
 */
export function reportSignalError(error: SignalError, context?: Context): void {
  const handler = resolveHandler(context);

  if (handler) {
    try {
      handler(error);
      return;
    } catch (handlerError) {
      defaultReport(
        toSignalError(handlerError, {
          phase: "handler",
          context,
          triggerFrames: [],
        }),
        context,
      );
      return;
    }
  }

  defaultReport(error, context);
}

/**
 * Runs a user callback during teardown without interrupting the remaining
 * teardown work.
 */
export function runSafely(fn: () => void, info: SignalErrorInfo): void {
  try {
    fn();
  } catch (error) {
    const signalError = toSignalError(error, info);
    reportSignalError(signalError, info.context);
  }
}

function resolveHandler(context?: Context): SignalErrorHandler | undefined {
  if (context) {
    const handler = (context as any)[ERROR_HANDLER] as SignalErrorHandler | undefined;
    if (handler) return handler;
  }
  return globalHandler ?? undefined;
}

function defaultReport(error: SignalError, _context?: Context): void {
  const reportError = (globalThis as any).reportError as
    | ((error: unknown) => void)
    | undefined;

  if (typeof reportError === "function") {
    try {
      reportError(error);
      return;
    } catch {
      // Fall through to console.
    }
  }

  console.error(error);
}

function collectScopes(): ReactiveScopeInfo[] {
  const scopes: ReactiveScopeInfo[] = [];
  for (const node of reactiveScopeStack) {
    const info = describeNode(node);
    if (info) scopes.push(info);
  }
  return scopes;
}

function formatMessage(
  cause: Error,
  info: SignalErrorInfo,
  scopes: readonly ReactiveScopeInfo[],
  trigger: readonly string[],
): string {
  const lines: string[] = [cause.message];

  if (info.label) {
    lines.push(`  update "${info.label}"`);
  }

  const nodeInfo = info.node ? describeNode(info.node) : undefined;
  const nodeInScopes =
    nodeInfo !== undefined &&
    scopes.some((scope) => scope.type === nodeInfo.type && scope.name === nodeInfo.name);

  if (nodeInfo && !nodeInScopes) {
    lines.push("", `  ${nodeInfo.type} "${nodeInfo.name}"`);
  }

  if (scopes.length > 0) {
    lines.push("", "Reactive context");

    const total = scopes.length;
    const showAll = total <= 6;
    const headCount = showAll ? total : 3;
    const tailCount = showAll ? 0 : 3;

    for (let i = 0; i < headCount; i++) {
      lines.push(formatScopeLine(i + 1, scopes[i]));
    }

    if (!showAll) {
      lines.push(`  ... (${total - headCount - tailCount} more)`);

      for (let i = total - tailCount; i < total; i++) {
        lines.push(formatScopeLine(i + 1, scopes[i]));
      }
    }
  }

  if (trigger.length > 0) {
    lines.push("", "Triggered from");
    for (const frame of trigger) lines.push(`  ${frame}`);
  }

  return lines.join("\n");
}

function formatScopeLine(number: number, scope: ReactiveScopeInfo): string {
  const suffix = scope.creationFrame ? ` created at ${scope.creationFrame}` : "";
  return `  ${number} → ${scope.type} "${scope.name}"${suffix}`;
}

/**
 * Best-effort extraction of the application frame(s) that initiated the
 * effect. The original stack already contains these frames for synchronous
 * setter/effect flushes; we just skip past the runtime boundary.
 */
function extractTriggerFrames(stack?: string): string[] {
  if (!stack) return [];

  const entries = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "));

  let boundary = -1;
  for (let i = 0; i < entries.length; i++) {
    if (TRIGGER_BOUNDARY.test(entries[i])) boundary = i;
  }

  if (boundary < 0) return [];

  const trigger: string[] = [];
  for (let i = boundary + 1; i < entries.length && trigger.length < 2; i++) {
    const line = entries[i];
    if (!INTERNAL_FRAME.test(line)) trigger.push(line.replace(/^at /, ""));
  }

  return trigger;
}
