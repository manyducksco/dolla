import { $watch, batch, computed, state, reader, type Mutable } from "../core";

/**
 * Augments an existing Writable by adding history controls.
 */
export function $history<T>(target: Mutable<T>, capacity = 20) {
  const timeline = state<T[]>([target.get()]);
  const cursor = state(0);

  // Internal flag to prevent the $watch from triggering when we move the cursor
  let isInternalUpdate = false;

  $watch(() => {
    const value = target.track();

    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }

    const currentTimeline = timeline.get();
    const currentIndex = cursor.get();

    // If we are in the middle of the timeline and make a new change, we must "branch"
    const newTimeline = currentTimeline.slice(0, currentIndex + 1);

    newTimeline.push(value);
    if (newTimeline.length > capacity) {
      newTimeline.shift();
    }

    batch(() => {
      timeline.set(newTimeline);
      cursor.set(newTimeline.length - 1);
    });
  });

  const jump = (index: number) => {
    const list = timeline.get();
    if (index >= 0 && index < list.length) {
      isInternalUpdate = true;
      batch(() => {
        cursor.set(index);
        target.set(list[index]);
      });
    }
  };

  return {
    undo: () => jump(cursor.get() - 1),
    redo: () => jump(cursor.get() + 1),
    canUndo: computed(() => cursor.track() > 0),
    canRedo: computed(() => cursor.track() < timeline.track().length - 1),

    timeline: reader(timeline),
    cursor: reader(cursor),
    jump,
  };
}
