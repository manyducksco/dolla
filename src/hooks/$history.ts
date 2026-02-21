import { $watch, batch, computed, state, toReadable, type Writable } from "../core";

/**
 * Augments an existing Writable by adding history controls.
 */
export function $history<T>(target: Writable<T>, capacity = 20) {
  const timeline = state<T[]>([target.read()]);
  const cursor = state(0);

  // Internal flag to prevent the $watch from triggering when we move the cursor
  let isInternalUpdate = false;

  $watch(() => {
    const value = target.track();

    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }

    const currentTimeline = timeline.read();
    const currentIndex = cursor.read();

    // If we are in the middle of the timeline and make a new change, we must "branch"
    const newTimeline = currentTimeline.slice(0, currentIndex + 1);

    newTimeline.push(value);
    if (newTimeline.length > capacity) {
      newTimeline.shift();
    }

    batch(() => {
      timeline.write(newTimeline);
      cursor.write(newTimeline.length - 1);
    });
  });

  const jump = (index: number) => {
    const list = timeline.read();
    if (index >= 0 && index < list.length) {
      isInternalUpdate = true;
      batch(() => {
        cursor.write(index);
        target.write(list[index]);
      });
    }
  };

  return {
    undo: () => jump(cursor.read() - 1),
    redo: () => jump(cursor.read() + 1),
    canUndo: computed(() => cursor.track() > 0),
    canRedo: computed(() => cursor.track() < timeline.track().length - 1),

    timeline: toReadable(timeline),
    cursor: toReadable(cursor),
    jump,
  };
}
