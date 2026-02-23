import type { Context } from "./context";

export type LifecycleEvent = "willMount" | "didMount" | "willUnmount" | "didUnmount" | "dispose";

export type LifecycleListener = () => any;

export enum LifecycleState {
  Unmounted = 0,
  WillMount = 1,
  DidMount = 2,
  WillUnmount = 3,
  DidUnmount = 4,
  Disposed = 5,
}

const lifecycleStateNames = {
  [LifecycleState.Unmounted]: "Unmounted",
  [LifecycleState.WillMount]: "WillMount",
  [LifecycleState.DidMount]: "DidMount",
  [LifecycleState.WillUnmount]: "WillUnmount",
  [LifecycleState.DidUnmount]: "DidUnmount",
  [LifecycleState.Disposed]: "Disposed",
};

/**
 * Manages lifecycle events for a Context.
 */
export class ContextLifecycle {
  private context;

  state = LifecycleState.Unmounted;
  listeners = new Map<LifecycleEvent, Set<LifecycleListener>>();
  bound?: Set<Context>;

  constructor(context: Context) {
    this.context = context;
  }

  /**
   * Listen for a certain event to be emitted. Listeners are called when the event results in a state change.
   */
  on<E extends LifecycleEvent>(event: E, listener: LifecycleListener) {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      this.listeners.set(event, new Set([listener]));
    } else {
      listeners.add(listener);
    }
    return () => this.off(event, listener);
  }

  /**
   * Stop a particular listener from being called when an event is emitted.
   */
  off<E extends LifecycleEvent>(event: E, listener: LifecycleListener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Advance the lifecycle state machine.
   */
  emit<E extends LifecycleEvent>(event: E) {
    let invalid = false;

    switch (event) {
      case "willMount": {
        if (this.state < LifecycleState.WillMount) {
          this.state = LifecycleState.WillMount;
          this.notify(event);
        } else {
          invalid = true;
        }
        break;
      }
      case "didMount": {
        if (this.state >= LifecycleState.WillMount && this.state < LifecycleState.DidMount) {
          this.state = LifecycleState.DidMount;
          this.notify(event);
        } else {
          invalid = true;
        }
        break;
      }
      case "willUnmount": {
        if (this.state >= LifecycleState.DidMount && this.state < LifecycleState.WillUnmount) {
          this.notify(event);
          this.state = LifecycleState.WillUnmount;
        } else {
          invalid = true;
        }
        break;
      }
      case "didUnmount": {
        if (this.state >= LifecycleState.WillUnmount && this.state < LifecycleState.DidUnmount) {
          // Loop back to .Unmounted
          this.state = LifecycleState.DidUnmount % LifecycleState.DidUnmount;
          this.notify(event);
        } else {
          invalid = true;
        }
        break;
      }
      case "dispose": {
        if (this.state === LifecycleState.Unmounted) {
          this.notify(event);
          this.listeners.clear();
          this.bound = undefined;
          this.context.state = undefined;
          this.context.stores = undefined;
          this.state = LifecycleState.Disposed;
        } else {
          invalid = true;
        }
        break;
      }
    }

    if (invalid) {
      this.context.logger.crash(
        new Error(
          `[${this.context.getName()}] Tried to '${event}' context at state ${this.state} (${lifecycleStateNames[this.state]})`,
        ),
      );
    }
  }

  /**
   * Bind `context` to this lifecycle; when any event is emitted here it will be emitted for `context` as well.
   */
  bind(context: Context) {
    if (!this.bound) {
      this.bound = new Set([context]);
    } else {
      this.bound.add(context);
    }
  }

  /**
   * Call all the event's listeners and re-emit to bound contexts.
   */
  private notify<E extends LifecycleEvent>(event: E) {
    // Call listener functions.
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener();
      }
    }
    // Emit to bound contexts.
    if (this.bound) {
      for (const context of this.bound) {
        context.lifecycle.emit(event);
      }
    }
  }
}
