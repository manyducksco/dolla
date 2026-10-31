import type { Context } from "../context.js";
import { reportSignalError, toSignalError } from "../errors.js";
import { DEBUG } from "../symbols.js";

export interface UpdateMeta {
  label?: string;
  context?: Context;
}

// Updates scheduled during a flush go into a new map, processed in the next wave.
let pendingUpdates = new Map<() => void, UpdateMeta | undefined>();
let isScheduled = false;
let isFlushing = false;
let collectUpdateStats = false;

/**
 * Updates scheduled during a flush run in a follow-up wave. A chain this long
 * means updates keep rescheduling each other, so the flush gives up instead of
 * freezing the page.
 */
const MAX_WAVES = 1000;

/**
 * Forces timing and label statistics for every update. Normally only updates
 * from a root created with `debug: true` are measured.
 */
export function setUpdateStats(enabled: boolean): void {
  collectUpdateStats = enabled;
}

function isMeasured(meta: UpdateMeta | undefined): boolean {
  if (collectUpdateStats) return true;
  return Boolean(meta?.context?.[DEBUG]);
}

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

  // Only updates from debug roots are timed and counted.
  let elapsed = 0;
  let count = 0;
  let labels: Record<string, number> | undefined;

  try {
    // Snapshot the updates so any updates added during the flush are also
    // processed. The original code relied on the Set iterator visiting
    // elements added during iteration, but the original code also broke
    // if any update threw — the throw would skip the cleanup and leave
    // the scheduler permanently stuck.
    let waves = 0;
    while (pendingUpdates.size > 0) {
      if (++waves > MAX_WAVES) {
        dropRunawayUpdates();
        break;
      }

      const wave = pendingUpdates;
      pendingUpdates = new Map();

      for (const [fn, meta] of wave) {
        if (!isMeasured(meta)) {
          runUpdate(fn, meta);
          continue;
        }

        count++;
        const label = meta?.label;
        if (label) {
          if (labels === undefined) labels = Object.create(null) as Record<string, number>;
          const current = labels[label];
          labels[label] = current === undefined ? 1 : current + 1;
        }

        const start = performance.now();
        runUpdate(fn, meta);
        elapsed += performance.now() - start;
      }
    }
  } finally {
    isScheduled = false;
    isFlushing = false;
  }

  if (count === 0) return;

  const ms = elapsed;
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
    console.warn(`[dolla] flushed ${count} update${count === 1 ? "" : "s"} in ${ms.toFixed(1)}ms${breakdown}`);
  }
}

function dropRunawayUpdates() {
  const labels = new Set<string>();
  let context: Context | undefined;
  for (const meta of pendingUpdates.values()) {
    if (meta?.label) labels.add(meta.label);
    context ??= meta?.context;
  }
  pendingUpdates.clear();

  const names = labels.size ? ` (${Array.from(labels).join(", ")})` : "";
  const error = new Error(
    `Updates kept rescheduling themselves for ${MAX_WAVES} rounds and were stopped${names}. ` +
      `An update is probably writing to a signal that triggers itself.`,
  );
  reportSignalError(toSignalError(error, { phase: "update", context, triggerFrames: [] }), context);
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
