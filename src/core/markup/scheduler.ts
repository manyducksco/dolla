import type { Context } from "../context.js";
import { reportSignalError, toSignalError } from "../errors.js";

interface UpdateMeta {
  label?: string;
  context?: Context;
}

type PendingUpdate = UpdateMeta & { fn: () => void };

const pendingUpdates = new Map<() => void, UpdateMeta>();
let isScheduled = false;
let isFlushing = false;

function flushUpdates() {
  if (isFlushing) return;
  isFlushing = true;
  const t0 = performance.now();
  let count = 0;
  try {
    // Snapshot the updates so any updates added during the flush are also
    // processed. The original code relied on the Set iterator visiting
    // elements added during iteration, but the original code also broke
    // if any update threw — the throw would skip the cleanup and leave
    // the scheduler permanently stuck.
    while (pendingUpdates.size > 0) {
      const updates: PendingUpdate[] = [];
      for (const [fn, meta] of pendingUpdates) {
        updates.push({ fn, ...meta });
      }
      pendingUpdates.clear();

      for (const update of updates) {
        count++;
        try {
          update.fn();
        } catch (error) {
          const signalError = toSignalError(error, {
            phase: "update",
            label: update.label,
            context: update.context,
            triggerFrames: [],
          });
          reportSignalError(signalError, update.context);
        }
      }
    }
  } finally {
    isScheduled = false;
    isFlushing = false;
  }
  const ms = performance.now() - t0;
  if (ms > 10) console.warn(`[dolla] flusher ran ${count} updates in ${ms.toFixed(1)}ms`);
}

export function flushPendingUpdates() {
  if (isScheduled) {
    flushUpdates();
  }
}

export function scheduleUpdate(updateFn: () => void, meta?: UpdateMeta) {
  pendingUpdates.set(updateFn, meta ?? {});
  if (!isScheduled) {
    isScheduled = true;
    queueMicrotask(flushUpdates);
  }
}
