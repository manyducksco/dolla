import type { Dolla, Logger } from "./dolla.js";

/**
 * Batches DOM updates; reads before writes.
 */
export class Batch {
  #dolla: Dolla;
  #logger: Logger;

  // Keys ensure only the most recent callback queued with a certain key
  // will be called, keeping DOM operations to a minimum.
  #keyedWrites = new Map<string, () => void>();

  // All unkeyed writes are run on every batch.
  #unkeyedWrites: (() => void)[] = [];

  // All read callbacks are run before updates on every batch.
  #reads: (() => void)[] = [];

  #batchInProgress = false;

  // When true, batches that would exceed 16ms will be split and deferred to a rAF.
  // This may not be desirable, because while it does prevent hitching it sometimes leaves
  // the state partially rendered for a brief second and certain elements can be seen to update after the fact.
  // But the tradeoff here is snappier navigation with possibly slightly out of date DOM updates on heavy pages.
  #deferIfOvertime = true;
  #deferrals = 0;

  #msFormat = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: "unit",
    unit: "millisecond",
    unitDisplay: "short",
  });

  constructor(dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("Dolla.batch");
  }

  /**
   * Queues a callback that runs before the next batch of writes.
   */
  read(callback: () => void) {
    this.#reads.push(callback);
    this.#queueBatch();
  }

  /**
   * Queues a callback to run in the next render batch.
   * Always put DOM mutations in a write callback when possible to help Dolla batch them efficiently.
   */
  write(callback: () => void, key?: string) {
    if (key) {
      this.#keyedWrites.set(key, callback);
    } else {
      this.#unkeyedWrites.push(callback);
    }
    this.#queueBatch();
  }

  #queueBatch() {
    if (!this.#batchInProgress) {
      this.#batchInProgress = true;
      const isDevEnv = this.#dolla.getEnv() === "development";
      queueMicrotask(() => {
        this.#runBatch(isDevEnv);
      });
    }
  }

  #runBatch(isDevEnv = false) {
    const start = performance.now();
    let elapsed = 0;

    const total = this.#reads.length + this.#keyedWrites.size + this.#unkeyedWrites.length;
    let completed = 0;

    /**
     * Runs after each operation. If true, the batch has been deferred and processing should stop. If false, processing of the current batch should continue.
     */
    const checkpoint = () => {
      completed++;
      elapsed = performance.now() - start;
      if (this.#deferIfOvertime && elapsed > 12 && completed < total) {
        this.#deferrals++;
        if (isDevEnv) {
          this.#logger.warn(
            `⚠️ Deferring batch to next frame. Performed ${completed} of ${total} batched operation${completed === 1 ? "" : "s"} in ${this.#msFormat.format(elapsed)} (deferral ${this.#deferrals}).`,
          );
        }
        requestAnimationFrame(() => {
          this.#runBatch(isDevEnv);
        });
        return true;
      }
      return false;
    };

    const keyedWrites = [...this.#keyedWrites.entries()];

    let key: string | undefined;
    let op: (() => void) | undefined;

    // Run reads.
    while ((op = this.#reads.shift())) {
      op();
      if (checkpoint()) return;
    }

    // Run keyed writes first.
    for ([key, op] of keyedWrites) {
      op();
      this.#keyedWrites.delete(key);
      if (checkpoint()) return;
    }

    // Run unkeyed writes second.
    while ((op = this.#unkeyedWrites.shift())) {
      op();
      if (checkpoint()) return;
    }

    if (isDevEnv) {
      this.#logger[elapsed > 16 ? "warn" : "info"](
        `${elapsed > 16 ? "⚠️ (>=16ms) " : ""}Executed ${completed} operation${completed === 1 ? "" : "s"} in ${this.#msFormat.format(elapsed)}${this.#deferrals > 0 ? ` (after ${this.#deferrals} deferral${this.#deferrals === 1 ? "" : "s"})` : ""}.`,
      );
    }
    this.#deferrals = 0;
    // Trigger again to catch updates queued while this batch was running.
    if (this.#reads.length || this.#keyedWrites.size || this.#unkeyedWrites.length) {
      queueMicrotask(() => {
        this.#runBatch(isDevEnv);
      });
    } else {
      this.#batchInProgress = false;
    }
  }
}
