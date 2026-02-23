import type { Context } from "./context";

let currentContext: Context | undefined;

export function getCurrentContext(): Context | undefined {
  return currentContext;
}

export function setCurrentContext(context: Context | undefined) {
  const prevContext = currentContext;
  currentContext = context;
  return prevContext;
}

export function performInContext(context: Context | undefined, callback: () => void) {
  const prevContext = currentContext;
  currentContext = context;
  try {
    callback();
  } finally {
    currentContext = prevContext;
  }
}
