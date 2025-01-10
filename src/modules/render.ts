import { isMounted } from "./core.js";
import { createLogger } from "./logging.js";

const debug = createLogger("dolla/render");

// Keyed updates ensure only the most recent callback queued with a certain key
// will be called, keeping DOM operations to a minimum.
const keyedUpdates = new Map<string, () => void>();

// All unkeyed updates are run on every batch.
let unkeyedUpdates: (() => void)[] = [];

let reads: (() => void)[] = [];

let isUpdating = false;

function runUpdates() {
  const totalQueued = keyedUpdates.size + unkeyedUpdates.length;

  if (!isMounted || totalQueued === 0) {
    isUpdating = false;
  }

  if (!isUpdating) {
    for (const callback of reads) {
      callback();
    }
    reads = [];
    return;
  }

  requestAnimationFrame(() => {
    debug.info(`Batching ${keyedUpdates.size + unkeyedUpdates.length} queued DOM update(s).`);

    // Run keyed updates first.
    for (const callback of keyedUpdates.values()) {
      callback();
    }
    keyedUpdates.clear();

    // Run unkeyed updates second.
    for (const callback of unkeyedUpdates) {
      callback();
    }
    unkeyedUpdates = [];

    // Trigger again to catch updates queued while this batch was running.
    runUpdates();
  });
}

/**
 * Queues a callback to run in the next render batch.
 * Running your DOM mutations in update callbacks reduces layout thrashing.
 * Returns a Promise that resolves once the callback has run.
 */
export function update(callback: () => void, key?: string): Promise<void> {
  return new Promise((resolve) => {
    if (key) {
      keyedUpdates.set(key, () => {
        callback();
        resolve();
      });
    } else {
      unkeyedUpdates.push(() => {
        callback();
        resolve();
      });
    }

    if (!isUpdating && isMounted) {
      isUpdating = true;
      runUpdates();
    }
  });
}

/**
 * Queues a callback that reads DOM information to run after the next render batch,
 * ensuring all writes have been performed before reading.
 * Returns a Promise that resolves once the callback has run.
 */
export function read(callback: () => void): Promise<void> {
  return new Promise((resolve) => {
    reads.push(() => {
      callback();
      resolve();
    });

    if (!isUpdating && isMounted) {
      isUpdating = true;
      runUpdates();
    }
  });
}
