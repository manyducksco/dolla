import type { Context } from "../context.js";
import { reportSignalError, toSignalError } from "../errors.js";

export interface UpdateMeta {
  label?: string;
  context?: Context;
}

// Two maps are swapped for each wave so updates scheduled during a flush are
// processed in the next wave. This avoids allocating a snapshot array and an
// object per update.
let pendingUpdates = new Map<() => void, UpdateMeta | undefined>();
let flushingUpdates = new Map<() => void, UpdateMeta | undefined>();
let isScheduled = false;
let isFlushing = false;

/**
 * Runs an update and reports any error through the signal error pipeline.
 * Also used for initial synchronous updates during mount, so they keep the
 * same error semantics as scheduled updates.
 */
export function runUpdate(updateFn: () => void, meta?: UpdateMeta): void {
  try {
    updateFn();
  } catch (error) {
    const signalError = toSignalError(error, {
      phase: "update",
      label: meta?.label,
      context: meta?.context,
      triggerFrames: [],
    });
    reportSignalError(signalError, meta?.context);
  }
}

function flushUpdates() {
  if (isFlushing) return;
  isFlushing = true;
  const t0 = performance.now();
  let count = 0;
  let labels: Record<string, number> | undefined;

  try {
    // Snapshot the updates so any updates added during the flush are also
    // processed. The original code relied on the Set iterator visiting
    // elements added during iteration, but the original code also broke
    // if any update threw — the throw would skip the cleanup and leave
    // the scheduler permanently stuck.
    while (pendingUpdates.size > 0) {
      const wave = pendingUpdates;
      pendingUpdates = flushingUpdates;
      flushingUpdates = wave;

      for (const [fn, meta] of wave) {
        count++;
        const label = meta?.label;
        if (label) {
          if (labels === undefined) labels = Object.create(null) as Record<string, number>;
          const current = labels[label];
          labels[label] = current === undefined ? 1 : current + 1;
        }
        runUpdate(fn, meta);
      }

      wave.clear();
    }
  } finally {
    isScheduled = false;
    isFlushing = false;
  }

  const ms = performance.now() - t0;
  if (ms > 10) {
    let breakdown = "";
    if (labels) {
      breakdown =
        "\n" +
        Object.entries(labels)
          .sort((a, b) => b[1] - a[1])
          .map(([label, labelCount]) => `  ${label}: ${labelCount}`)
          .join("\n");
    }
    console.warn(`[dolla] flusher ran ${count} updates in ${ms.toFixed(1)}ms${breakdown}`);
  }
}

export function flushPendingUpdates() {
  if (isScheduled) {
    flushUpdates();
  }
}

export function scheduleUpdate(updateFn: () => void, meta?: UpdateMeta) {
  pendingUpdates.set(updateFn, meta);
  if (!isScheduled) {
    isScheduled = true;
    queueMicrotask(flushUpdates);
  }
}
