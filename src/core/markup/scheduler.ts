const pendingUpdates = new Set<() => void>();
let isScheduled = false;
let isFlushing = false;

function flushUpdates() {
  if (isFlushing) return;
  isFlushing = true;
  for (const update of pendingUpdates) update();
  pendingUpdates.clear();
  isScheduled = false;
  isFlushing = false;
}

export function flushPendingUpdates() {
  if (isScheduled) {
    flushUpdates();
  }
}

export function scheduleUpdate(updateFn: () => void) {
  pendingUpdates.add(updateFn);
  if (!isScheduled) {
    isScheduled = true;
    queueMicrotask(flushUpdates);
  }
}
