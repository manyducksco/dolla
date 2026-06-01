import type { ReactiveNode } from "./signals.js";

interface ReactiveNodeDebug {
  type: "composed" | "effect";
  name: string;
  creationStack?: string;
}

const componentNameStack: string[] = [];
const reactiveScopeStack: ReactiveNode[] = [];
const nodeDebug = new WeakMap<ReactiveNode, ReactiveNodeDebug>();

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
    creationStack: new Error().stack,
  });
}

function enhanceError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  if ((error as any)._dollaEnhanced) return error;

  const scopes = reactiveScopeStack.slice();
  if (scopes.length === 0) return error;

  const lines: string[] = ["", "--- Reactive context ---"];
  const total = scopes.length;
  const showAll = total <= 6;
  const headCount = showAll ? total : 3;
  const tailCount = showAll ? 0 : 3;

  for (let i = 0; i < headCount; i++) {
    appendScopeLine(lines, i + 1, scopes[i]);
  }

  if (!showAll) {
    const hidden = total - headCount - tailCount;
    lines.push(`  ... (${hidden} more)`);

    for (let i = total - tailCount; i < total; i++) {
      appendScopeLine(lines, i + 1, scopes[i]);
    }
  }

  const originalMessage = error.message;
  const originalStack = error.stack;
  (error as any)._dollaEnhanced = true;
  error.message += "\n" + lines.join("\n");
  if (!error.cause) {
    const cause = new Error(originalMessage);
    cause.stack = originalStack;
    error.cause = cause;
  }
  return error;
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

function appendScopeLine(lines: string[], number: number, node: ReactiveNode): void {
  const info = nodeDebug.get(node);
  if (info) {
    const frame = getCreationFrame(info.creationStack);
    const suffix = frame ? ` created at ${frame}` : "";
    lines.push(`  ${number} → ${info.type} "${info.name}"${suffix}`);
  }
}

export {
  reactiveScopeStack,
  setNodeDebug,
  enhanceError,
};
