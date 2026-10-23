import { onCleanup, onMount, type Context } from "./context.js";

/**
 * The symbol used to store a `SuspendScope` on a context. Scopes are inherited
 * through the context prototype chain, so any view inside a keep-alive side can
 * find the nearest scope.
 */
export const SUSPEND_SCOPE = Symbol.for("$_SUSPEND_SCOPE");

/**
 * A user-facing suspend/resume callback registered with `onSuspend` / `onResume`.
 */
export interface ScopeHook {
  suspend?(): void;
  resume?(): void;
}

/**
 * A resource that owns DOM outside the normal logical tree (portals) or
 * propagates suspension to a nested keep-alive.
 */
export interface ScopeResource {
  suspend(): void;
  resume(): void;
}

function reportError(action: string, error: unknown) {
  console.error(`[dolla] Error in suspend ${action}:`, error);
}

/**
 * Tracks hooks and structural resources for one keep-alive branch side.
 *
 * Ordering matters:
 * - `suspend()` runs hooks first (while the DOM is still connected), then
 *   structural resources (which may detach DOM).
 * - `resume()` runs structural resources first (reattaching DOM), then hooks.
 */
export class SuspendScope {
  suspended = false;

  #hooks = new Set<ScopeHook>();
  #resources = new Set<ScopeResource>();

  addHook(hook: ScopeHook) {
    this.#hooks.add(hook);
    if (this.suspended) this.#runHook(hook, "suspend");
  }

  deleteHook(hook: ScopeHook) {
    this.#hooks.delete(hook);
  }

  addResource(resource: ScopeResource) {
    this.#resources.add(resource);
    if (this.suspended) {
      try {
        resource.suspend();
      } catch (error) {
        reportError("resource", error);
      }
    }
  }

  deleteResource(resource: ScopeResource) {
    this.#resources.delete(resource);
  }

  suspend() {
    if (this.suspended) return;
    this.suspended = true;

    // Hooks run before anything is detached so they can read/measure the DOM.
    const hooks = Array.from(this.#hooks);
    for (const hook of hooks) {
      if (this.#hooks.has(hook)) this.#runHook(hook, "suspend");
    }

    const resources = Array.from(this.#resources);
    for (const resource of resources) {
      if (!this.#resources.has(resource)) continue;
      try {
        resource.suspend();
      } catch (error) {
        reportError("resource", error);
      }
    }
  }

  resume() {
    if (!this.suspended) return;
    this.suspended = false;

    // Resources first, so hooks always observe reattached DOM.
    const resources = Array.from(this.#resources);
    for (const resource of resources) {
      if (!this.#resources.has(resource)) continue;
      try {
        resource.resume();
      } catch (error) {
        reportError("resource", error);
      }
    }

    const hooks = Array.from(this.#hooks);
    for (const hook of hooks) {
      if (this.#hooks.has(hook)) this.#runHook(hook, "resume");
    }
  }

  #runHook(hook: ScopeHook, action: "suspend" | "resume") {
    const fn = hook[action];
    if (!fn) return;
    try {
      fn();
    } catch (error) {
      reportError(action, error);
    }
  }
}

/**
 * Returns true if the nearest keep-alive scope for `context` is suspended.
 * This is a plain boolean read and is intentionally not reactive.
 */
export function isSuspended(context: Context): boolean {
  return Boolean((context as any)[SUSPEND_SCOPE]?.suspended);
}

/**
 * Registers a callback to run when the nearest keep-alive scope is suspended.
 * If the scope is already suspended, the callback runs immediately, or after
 * mount for content that is currently mounting.
 */
export function onSuspend(context: Context, fn: () => void) {
  registerHook(context, { suspend: fn });
}

/**
 * Registers a callback to run when the nearest keep-alive scope is resumed.
 */
export function onResume(context: Context, fn: () => void) {
  registerHook(context, { resume: fn });
}

function registerHook(context: Context, hook: ScopeHook) {
  const scope = (context as any)[SUSPEND_SCOPE] as SuspendScope | undefined;
  if (!scope) return;

  onCleanup(context, () => scope.deleteHook(hook));

  if (context.isMounted) {
    scope.addHook(hook);
  } else {
    // Wait until the view's DOM and resources exist before running hooks.
    onMount(context, () => scope.addHook(hook));
  }
}
