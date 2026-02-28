const pendingUpdates = new Set<() => void>();
let isScheduled = false;

function flushUpdates() {
  for (const update of pendingUpdates) {
    try {
      update();
    } catch (error) {
      console.error("Reactivity Error:", error);
    }
  }
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
