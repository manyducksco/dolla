export type Callback = () => void;

/**
 * Centralized scheduling for DOM updates.
 */
class Scheduler {
  #keyed = new Map<string, Callback>();
  #unkeyed: Callback[] = [];
  #nextTickCallbacks: Callback[] = [];
  #tickScheduled = false;
  #verbose = true;

  /**
   * Schedules an update on the next tick. If `key` is supplied, this update will replace any scheduled update with the same key.
   */
  scheduleUpdate(update: Callback, key?: string) {
    if (key) {
      this.#keyed.set(key, update);
    } else {
      this.#unkeyed.push(update);
    }
    this.#requestTick();
  }

  /**
   * Registers a callback to run after all processing has finished in the next tick.
   */
  nextTick(callback: Callback) {
    this.#nextTickCallbacks.push(callback);
    this.#requestTick();
  }

  /**
   * Lets the scheduler know there is work to be done.
   */
  #requestTick() {
    if (this.#tickScheduled) return;
    queueMicrotask(this.#processTick);
    this.#tickScheduled = true;
  }

  #processTick = () => {
    const start = performance.now();
    const numKeyed = this.#keyed.size;
    const numUnkeyed = this.#unkeyed.length;

    // Process keyed updates.
    for (const update of this.#keyed.values()) {
      update();
    }
    this.#keyed.clear();

    // Process unkeyed updates.
    for (const update of this.#unkeyed) {
      update();
    }
    this.#unkeyed.length = 0;

    // Save last tick time.
    const end = performance.now();

    if (this.#verbose) {
      console.log(`processed tick in ${end - start}ms (${numKeyed} keyed + ${numUnkeyed} unkeyed)`);
    }

    // Process nextTick callbacks.
    for (const callback of this.#nextTickCallbacks) {
      callback();
    }
    this.#nextTickCallbacks.length = 0;

    this.#tickScheduled = false;
  };
}

export default new Scheduler();
