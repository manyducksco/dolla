import type { Context } from "./context.js";
import type { ReactiveNode } from "./signals.js";
import { DEBUG } from "./symbols.js";

export interface ReactiveScopeInfo {
  type: "effect" | "composed";
  name: string;
  creationFrame?: string;
}

// Contexts of the views, stores and context effects currently being set up.
// Signals created meanwhile take their debug name and debug setting from the top.
const contextStack: Context[] = [];
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
 * Records a node's debug name, and its creation stack when the context it was
 * created in belongs to a debug root. `context` is used when the creator passes
 * one explicitly (e.g. `createEffect`'s `context` option); otherwise the
 * context on top of the stack is used.
 */
function setNodeDebug(
  node: ReactiveNode,
  type: ReactiveScopeInfo["type"],
  fn: Function,
  nameOverride?: string,
  context?: Context,
): void {
  const current = contextStack.at(-1);
  const componentName = current?.name;
  const fnName = nameOverride || fn.name || "(anonymous)";

  node._debugType = type;
  node._debugName = componentName ? `${componentName} → ${fnName}` : fnName;
  if (forceCreationStacks || (context ?? current)?.[DEBUG]) node._debugStack = new Error().stack;
}

function describeNode(node: ReactiveNode): ReactiveScopeInfo | undefined {
  if (node._debugName === undefined) return undefined;

  return {
    type: node._debugType!,
    name: node._debugName,
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

export {
  reactiveScopeStack,
  setNodeDebug,
  describeNode,
};
