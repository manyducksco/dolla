import { isMounted, onAfterMount, onBeforeCleanup, onCleanup, type Context } from "./context.js";
import { HIDDEN } from "./symbols.js";

/**
 * The symbol used to store a `VisibilityScope` on a context. Scopes are
 * inherited through the context prototype chain, so any view inside a
 * keep-alive side can find the nearest scope.
 */
export const VISIBILITY_SCOPE = Symbol.for("$_VISIBILITY_SCOPE");

/**
 * Per-context list of visibility hooks, used to fire `onHide` for just this
 * context when it unmounts while visible.
 */
const VISIBILITY_HOOKS = Symbol.for("$_VISIBILITY_HOOKS");

/**
 * A user-facing hide/show callback registered with `onHide` / `onShow`.
 */
export interface ScopeHook {
  hide?(): void;
  show?(): void;
}

/**
 * A resource that owns DOM outside the normal logical tree (portals) or
 * propagates visibility to a nested keep-alive.
 */
export interface ScopeResource {
  hide(): void;
  show(): void;
}

function reportError(action: string, error: unknown) {
  console.error(`[dolla] Error in visibility ${action}:`, error);
}

/**
 * Tracks hooks and structural resources for one keep-alive branch side.
 *
 * Ordering matters:
 * - `hide()` runs hooks first (while the DOM is still connected), then
 *   structural resources (which may detach DOM).
 * - `show()` runs structural resources first (reattaching DOM), then hooks.
 */
export class VisibilityScope {
  hidden = false;

  #hooks = new Set<ScopeHook>();
  #resources = new Set<ScopeResource>();

  addHook(hook: ScopeHook) {
    this.#hooks.add(hook);
    if (!this.hidden) this.#runHook(hook, "show");
  }

  deleteHook(hook: ScopeHook) {
    this.#hooks.delete(hook);
  }

  addResource(resource: ScopeResource) {
    this.#resources.add(resource);
    if (this.hidden) {
      try {
        resource.hide();
      } catch (error) {
        reportError("resource", error);
      }
    }
  }

  deleteResource(resource: ScopeResource) {
    this.#resources.delete(resource);
  }

  hide() {
    if (this.hidden) return;
    this.hidden = true;

    // Hooks run before anything is detached so they can read/measure the DOM.
    const hooks = Array.from(this.#hooks);
    for (const hook of hooks) {
      if (this.#hooks.has(hook)) this.#runHook(hook, "hide");
    }

    const resources = Array.from(this.#resources);
    for (const resource of resources) {
      if (!this.#resources.has(resource)) continue;
      try {
        resource.hide();
      } catch (error) {
        reportError("resource", error);
      }
    }
  }

  show() {
    if (!this.hidden) return;
    this.hidden = false;

    // Resources first, so hooks always observe reattached DOM.
    const resources = Array.from(this.#resources);
    for (const resource of resources) {
      if (!this.#resources.has(resource)) continue;
      try {
        resource.show();
      } catch (error) {
        reportError("resource", error);
      }
    }

    const hooks = Array.from(this.#hooks);
    for (const hook of hooks) {
      if (this.#hooks.has(hook)) this.#runHook(hook, "show");
    }
  }

  #runHook(hook: ScopeHook, action: "hide" | "show") {
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
 * Returns true when the context is mounted and not hidden by keep-alive.
 *
 * This is a plain boolean read and is intentionally not reactive.
 */
export function isVisible(context: Context): boolean {
  const scope = (context as any)[VISIBILITY_SCOPE] as VisibilityScope | undefined;
  return isMounted(context) && !(context as any)[HIDDEN] && !scope?.hidden;
}

/**
 * Registers a callback to run when the nearest surrounding content becomes
 * hidden. It runs only after the content has been shown at least once.
 *
 * Registering while visible does not call the callback immediately; it runs on
 * the next hide. Registering while hidden waits for the next show/hide cycle.
 */
export function onHide(context: Context, fn: () => void) {
  registerHook(context, { hide: fn });
}

/**
 * Registers a callback to run when the nearest surrounding content becomes
 * visible. It runs on initial visible mount and after each restore.
 */
export function onShow(context: Context, fn: () => void) {
  registerHook(context, { show: fn });
}

function registerHook(context: Context, hook: ScopeHook) {
  let hooks = (context as any)[VISIBILITY_HOOKS] as ScopeHook[] | undefined;

  if (!hooks) {
    hooks = [];
    (context as any)[VISIBILITY_HOOKS] = hooks;

    // Fire hide hooks for this context before it is disposed while visible.
    onBeforeCleanup(context, () => hideContext(context));
  }

  hooks.push(hook);

  const scope = (context as any)[VISIBILITY_SCOPE] as VisibilityScope | undefined;

  const attach = () => {
    if (!isMounted(context)) return;
    scope?.addHook(hook);
    if (!scope && isVisible(context)) hook.show?.();
  };

  onCleanup(context, () => {
    const current = (context as any)[VISIBILITY_HOOKS] as ScopeHook[] | undefined;
    if (!current) return;

    const index = current.indexOf(hook);
    if (index !== -1) current.splice(index, 1);
    if (current.length === 0) delete (context as any)[VISIBILITY_HOOKS];

    scope?.deleteHook(hook);
  });

  if (isMounted(context)) {
    attach();
  } else {
    // Wait until the view's DOM and resources exist before running hooks.
    onAfterMount(context, attach);
  }
}

/**
 * Fires this context's hide hooks before it is detached or disposed.
 * Does nothing if the context is already hidden or unmounted.
 */
export function hideContext(context: Context) {
  if (!isVisible(context)) return;

  (context as any)[HIDDEN] = true;

  const hooks = (context as any)[VISIBILITY_HOOKS] as ScopeHook[] | undefined;
  if (!hooks) return;

  const scope = (context as any)[VISIBILITY_SCOPE] as VisibilityScope | undefined;

  for (const hook of [...hooks]) {
    scope?.deleteHook(hook);
    try {
      hook.hide?.();
    } catch (error) {
      reportError("hide", error);
    }
  }
}
