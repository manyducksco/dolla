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
const nodeDebug = new WeakMap<ReactiveNode, ReactiveNodeDebug>();

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
  nodeDebug.set(node, {
    type,
    name: componentName ? `${componentName} → ${fnName}` : fnName,
    creationStack: collectCreationStacks ? new Error().stack : undefined,
  });
}

function getNodeDebugInfo(node: ReactiveNode): ReactiveNodeDebug | undefined {
  return nodeDebug.get(node);
}

function describeNode(node: ReactiveNode): ReactiveScopeInfo | undefined {
  const info = nodeDebug.get(node);
  if (!info) return undefined;

  return {
    type: info.type,
    name: info.name,
    creationFrame: getCreationFrame(info.creationStack),
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
