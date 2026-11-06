import type { Context } from "./context.js";
import type { ReactiveNode } from "./signals.js";
import { DEBUG } from "./symbols.js";

export interface ReactiveScopeInfo {
  type: "effect" | "composed";
  name: string;
  creationFrame?: string;
}

/** The fields `describeNode` reads. Computed nodes have `_getter`, effects `_fn`. */
type DescribableNode = ReactiveNode & { _getter?: Function; _fn?: Function };

// Contexts of the views, stores and context effects currently being set up.
// Signals created meanwhile take their debug name and debug setting from the top.
const contextStack: Context[] = [];
// Entered and left with push() and pop() only. Restoring `length` instead goes through
// V8's slow array-length path and doubled the cost of running an effect.
const reactiveScopeStack: ReactiveNode[] = [];

/** Matches stack frames from the reactive runtime, in source or in the built `dist`. */
export const INTERNAL_FRAME =
  /(?:^|[/\\])(?:core|dist)[/\\](?:signals|errors|signal-debug|scheduler|root|context)(?:-[\w-]+)?\.(?:ts|js)(?::\d+:\d+)?/;

let forceCreationStacks = false;

/**
 * Forces creation-stack capture for every signal, including signals created
 * outside any root. This is expensive because it constructs an `Error` for
 * every effect and computed value. Normally stacks are captured only for
 * signals created inside a root with `createRoot(..., { debug: true })`.
 */
export function setSignalDebug(enabled: boolean): void {
  forceCreationStacks = enabled;
}

export function pushContext(context: Context): void {
  contextStack.push(context);
}

export function popContext(): void {
  contextStack.pop();
}

/**
 * Records where a node was created: the context (for its name in error
 * messages), an optional name override, and a creation stack when that context
 * belongs to a debug root. `context` is used when the creator passes one
 * explicitly (e.g. `createEffect`'s `context` option); otherwise the context on
 * top of the stack is used.
 *
 * Only references are stored. The display name is built by `describeNode` when
 * an error is reported, so creating a signal does no string work.
 */
function setNodeDebug(node: ReactiveNode, nameOverride?: string, context?: Context): void {
  const current = context ?? contextStack[contextStack.length - 1];
  if (current !== undefined) node._debugContext = current;
  if (nameOverride !== undefined) node._debugName = nameOverride;
  if (forceCreationStacks || current?.[DEBUG]) node._debugStack = new Error().stack;
}

function describeNode(node: ReactiveNode): ReactiveScopeInfo | undefined {
  const { _getter, _fn } = node as DescribableNode;
  const fn = _getter ?? _fn;
  // Plain value atoms have neither and are never described.
  if (fn === undefined) return undefined;

  const fnName = node._debugName || fn.name || "(anonymous)";
  const componentName = node._debugContext?.name;

  return {
    type: _getter !== undefined ? "composed" : "effect",
    name: componentName ? `${componentName} → ${fnName}` : fnName,
    creationFrame: getCreationFrame(node._debugStack),
  };
}

function getCreationFrame(stack?: string): string {
  if (!stack) return "";
  for (const entry of stack.split("\n")) {
    const line = entry.trim();
    if (line.startsWith("at ") && !INTERNAL_FRAME.test(line)) return line.slice(3);
  }
  return "";
}

export { reactiveScopeStack, setNodeDebug, describeNode };
