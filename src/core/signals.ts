import { createReactiveSystem, type Dependency, type Subscriber, SubscriberFlags } from "alien-signals";
import type { EqualityFunction } from "./signals-api";

export interface Effect extends Subscriber, Dependency {
  /**
   * Effect function. Can return an optional cleanup callback to be invoked before the next fn() call.
   */
  fn(): (() => void) | void;

  cleanup?: () => void;
}

export interface Computed<T = any> extends Value<T | undefined>, Subscriber {
  getter: (cachedValue?: T) => T;
  equals: EqualityFunction<T>;
}

export interface Value<T = any> extends Dependency {
  current: T;
}

export const {
  link,
  propagate,
  updateDirtyFlag,
  startTracking,
  endTracking,
  processEffectNotifications,
  processComputedUpdate,
  processPendingInnerEffects,
} = createReactiveSystem({
  updateComputed(c: Computed): boolean {
    const prevSub = activeSub;
    activeSub = c;
    startTracking(c);
    try {
      const oldValue = c.current;
      const newValue = c.getter(oldValue);
      if (!c.equals(oldValue, newValue)) {
        c.current = newValue;
        return true;
      }
      return false;
    } finally {
      activeSub = prevSub;
      endTracking(c);
    }
  },
  notifyEffect(e: Effect) {
    const flags = e.flags;
    if (flags & SubscriberFlags.Dirty || (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(e, flags))) {
      queueEffect(e);
    } else {
      processPendingInnerEffects(e, e.flags);
    }
    return true;
  },
});

/*===================================*\
||        EFFECTS & TRACKING         ||
\*===================================*/

export let activeSub: Subscriber | undefined;

const PENDING_EFFECTS: Effect[] = [];

let flushPending = false;

function flushEffects(): void {
  if (!flushPending) {
    flushPending = true;

    queueMicrotask(() => {
      flushPending = false;
      for (let i = 0; i < PENDING_EFFECTS.length; i++) {
        const e = PENDING_EFFECTS[i];
        const prevSub = activeSub;
        activeSub = e;
        startTracking(e);
        try {
          if (e.cleanup) {
            pauseTracking();
            e.cleanup();
            resumeTracking();
          }
          e.cleanup = e.fn() ?? undefined;
        } finally {
          activeSub = prevSub;
          endTracking(e);
        }
      }
      PENDING_EFFECTS.length = 0;
    });
  }
}

export function queueEffect(e: Effect) {
  PENDING_EFFECTS.push(e);
  flushEffects();
}

export function stopEffect(this: Effect): void {
  startTracking(this);
  endTracking(this);
  // Cancel it after it receives its current value.
  queueMicrotask(() => {
    PENDING_EFFECTS.splice(PENDING_EFFECTS.indexOf(this), 1);
    if (this.cleanup) {
      this.cleanup();
    }
  });
}

const pauseStack: (Subscriber | undefined)[] = [];

export function pauseTracking() {
  pauseStack.push(activeSub);
  activeSub = undefined;
}

export function resumeTracking() {
  activeSub = pauseStack.pop();
}
