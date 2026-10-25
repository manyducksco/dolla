import type { ReactiveNode } from "./signals.js";

export interface ReactiveNodeDebug {
  type: "composed" | "effect";
  name: string;
  creationStack?: string;
}

export interface ReactiveScopeInfo {
  type: "effect" | "composed";
  name: string;
  creationFrame?: string;
}

const componentNameStack: string[] = [];
const reactiveScopeStack: ReactiveNode[] = [];

let collectCreationStacks = false;

/**
 * Enables creation-stack capture for signals. This is expensive because it
 * constructs an `Error` for every effect and computed value, so it is opt-in.
 * `createRoot(..., { debug: true })` enables it automatically.
 */
export function setSignalDebug(enabled: boolean): void {
  collectCreationStacks = enabled;
}

export function pushComponentName(name: string): void {
  componentNameStack.push(name);
}

export function popComponentName(): void {
  componentNameStack.pop();
}

function setNodeDebug(
  node: ReactiveNode,
  type: ReactiveNodeDebug["type"],
  fn: Function,
  nameOverride?: string,
): void {
  const componentName =
    componentNameStack.length > 0 ? componentNameStack[componentNameStack.length - 1] : undefined;
  const fnName = nameOverride || fn.name || "(anonymous)";

  node._debugType = type;
  node._debugName = componentName ? `${componentName} → ${fnName}` : fnName;
  if (collectCreationStacks) node._debugStack = new Error().stack;
}

function getNodeDebugInfo(node: ReactiveNode): ReactiveNodeDebug | undefined {
  if (node._debugName === undefined) return undefined;

  return {
    type: node._debugType!,
    name: node._debugName,
    creationStack: node._debugStack,
  };
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
  const entries = stack.split("\n");
  for (let i = 2; i < entries.length; i++) {
    const line = entries[i].trim();
    if (line.startsWith("at ") && !line.includes("signal-debug.ts") && !line.includes("signals.ts")) {
      return line.replace(/^at /, "");
    }
  }
  return "";
}

export {
  reactiveScopeStack,
  setNodeDebug,
  getNodeDebugInfo,
  describeNode,
};
