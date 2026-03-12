const pendingUpdates = new Set<() => void>();
let isScheduled = false;

function flushUpdates() {
  for (const update of pendingUpdates) update();
  pendingUpdates.clear();
  isScheduled = false;
}

export function scheduleUpdate(updateFn: () => void) {
  pendingUpdates.add(updateFn);
  if (!isScheduled) {
    isScheduled = true;
    queueMicrotask(flushUpdates);
  }
}
