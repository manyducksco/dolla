import type { Dolla, Logger } from "./dolla.js";

export class Render {
  #dolla: Dolla;
  #logger: Logger;

  // Keyed updates ensure only the most recent callback queued with a certain key
  // will be called, keeping DOM operations to a minimum.
  #keyedUpdates = new Map<string, () => void>();

  // All unkeyed updates are run on every batch.
  #unkeyedUpdates: (() => void)[] = [];

  // All read callbacks are run before updates on every batch.
  #reads: (() => void)[] = [];

  #isUpdating = false;

  constructor(dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("dolla/render");
  }

  /**
   * Queues a callback to run in the next render batch.
   * Running your DOM mutations in update callbacks reduces layout thrashing.
   * Returns a Promise that resolves once the callback has run.
   */
  update(callback: () => void, key?: string): Promise<void> {
    return new Promise((resolve) => {
      if (key) {
        this.#keyedUpdates.set(key, () => {
          callback();
          resolve();
        });
      } else {
        this.#unkeyedUpdates.push(() => {
          callback();
          resolve();
        });
      }

      if (!this.#isUpdating && this.#dolla.isMounted) {
        this.#isUpdating = true;
        this.#runUpdates();
      }
    });
  }

  /**
   * Queues a callback that reads DOM information to run after the next render batch,
   * ensuring all writes have been performed before reading.
   * Returns a Promise that resolves once the callback has run.
   */
  read(callback: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.#reads.push(() => {
        callback();
        resolve();
      });

      if (!this.#isUpdating && this.#dolla.isMounted) {
        this.#isUpdating = true;
        this.#runUpdates();
      }
    });
  }

  #runUpdates() {
    const totalQueued = this.#keyedUpdates.size + this.#unkeyedUpdates.length;

    if (!this.#dolla.isMounted || totalQueued === 0) {
      this.#isUpdating = false;
    }

    if (!this.#isUpdating) {
      for (const callback of this.#reads) {
        callback();
      }
      this.#reads = [];
      return;
    }

    requestAnimationFrame(() => {
      this.#logger.info(`Batching ${this.#keyedUpdates.size + this.#unkeyedUpdates.length} queued DOM update(s).`);

      // Run keyed updates first.
      for (const callback of this.#keyedUpdates.values()) {
        callback();
      }
      this.#keyedUpdates.clear();

      // Run unkeyed updates second.
      for (const callback of this.#unkeyedUpdates) {
        callback();
      }
      this.#unkeyedUpdates = [];

      // Trigger again to catch updates queued while this batch was running.
      this.#runUpdates();
    });
  }
}
