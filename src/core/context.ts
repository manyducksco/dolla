import { uniqueId } from "../utils";
import { resumeEffects } from "./signals";

export type LifecycleListener = () => any;

type BaseContextState = {
  id: string;
  name: string;
  isMounted: boolean;
  isSuspended: boolean;
};

export type Context<T = Record<string | symbol, any>> = BaseContextState & T;

/*===================================*\
||           Global Context          ||
\*===================================*/

let activeContext: Context | undefined;

export function getActiveContext() {
  return activeContext;
}

export function setActiveContext(context: Context | undefined) {
  const prev = activeContext;
  activeContext = context;
  return prev;
}

/**
 * Runs `callback` while `context` is active. Hooks may be called inside `callback`.
 */
export function callInContext<T>(context: Context | undefined, callback: () => T): T {
  const prevContext = setActiveContext(context);
  try {
    return callback();
  } finally {
    setActiveContext(prevContext);
  }
}

/*===================================*\
||              Context              ||
\*===================================*/

const MOUNT_LISTENERS = Symbol("Context.mountListeners");
const UNMOUNT_LISTENERS = Symbol("Context.unmountListeners");

export function createContext(name: string, parent?: Context): Context {
  const ctx: Record<any, any> = parent ? Object.create(parent) : {};
  ctx.id = uniqueId();
  ctx.name = name;
  ctx.isMounted = false;
  ctx.isSuspended = true;
  return ctx as Context;
}

export function mountContext(context: Context) {
  if (context.isMounted) return;
  context.isMounted = true;
  resumeContext(context);
  _callListeners(context, MOUNT_LISTENERS);
}

export function unmountContext(context: Context) {
  if (!context.isMounted) return;
  context.isMounted = false;
  _callListeners(context, UNMOUNT_LISTENERS);
}

export function suspendContext(context: Context) {
  context.isSuspended = true;
}

export function resumeContext(context: Context) {
  context.isSuspended = false;
  resumeEffects(context);
}

export function onMount(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, MOUNT_LISTENERS)) context[MOUNT_LISTENERS] = [fn];
  else context[MOUNT_LISTENERS].push(fn);
  return _unsubscribe.bind(context[MOUNT_LISTENERS], fn);
}

export function onUnmount(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, UNMOUNT_LISTENERS)) context[UNMOUNT_LISTENERS] = [fn];
  else context[UNMOUNT_LISTENERS].push(fn);
  return _unsubscribe.bind(context[UNMOUNT_LISTENERS], fn);
}

function _unsubscribe(this: LifecycleListener[] | undefined, fn: LifecycleListener) {
  if (!this) return;
  const index = this.indexOf(fn);
  if (index !== -1) this.splice(index, 1);
}

function _callListeners(context: Context, key: symbol) {
  if (Object.hasOwn(context, key)) {
    for (const callback of context[key]) {
      callback();
    }
  }
}
