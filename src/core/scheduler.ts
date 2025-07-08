export type Callback = () => void;

// Basic port modification of Reacts Scheduler: https://github.com/facebook/react/tree/master/packages/scheduler
export interface Task {
  id: number;
  fn: ((didTimeout: boolean) => void) | null;
  startTime: number;
  expirationTime: number;
}

// experimental new feature proposal stuff
type NavigatorScheduling = Navigator & {
  scheduling: { isInputPending?: () => boolean };
};

let taskIdCounter = 1,
  isCallbackScheduled = false,
  isPerformingWork = false,
  taskQueue: Task[] = [],
  currentTask: Task | null = null,
  shouldYieldToHost: (() => boolean) | null = null,
  yieldInterval = 5,
  deadline = 0,
  maxYieldInterval = 300,
  scheduleCallback: (() => void) | null = null,
  scheduledCallback: ((hasTimeRemaining: boolean, initialTime: number) => boolean) | null = null;

const maxSigned31BitInt = 1073741823;

function setupScheduler() {
  const channel = new MessageChannel(),
    port = channel.port2;
  scheduleCallback = () => port.postMessage(null);
  channel.port1.onmessage = () => {
    if (scheduledCallback !== null) {
      const currentTime = performance.now();
      deadline = currentTime + yieldInterval;
      const hasTimeRemaining = true;
      try {
        const hasMoreWork = scheduledCallback(hasTimeRemaining, currentTime);
        if (!hasMoreWork) {
          scheduledCallback = null;
        } else port.postMessage(null);
      } catch (error) {
        // If a scheduler task throws, exit the current browser task so the
        // error can be observed.
        port.postMessage(null);
        throw error;
      }
    }
  };

  if (
    navigator &&
    (navigator as NavigatorScheduling).scheduling &&
    (navigator as NavigatorScheduling).scheduling.isInputPending
  ) {
    const scheduling = (navigator as NavigatorScheduling).scheduling;
    shouldYieldToHost = () => {
      const currentTime = performance.now();
      if (currentTime >= deadline) {
        // There's no time left. We may want to yield control of the main
        // thread, so the browser can perform high priority tasks. The main ones
        // are painting and user input. If there's a pending paint or a pending
        // input, then we should yield. But if there's neither, then we can
        // yield less often while remaining responsive. We'll eventually yield
        // regardless, since there could be a pending paint that wasn't
        // accompanied by a call to `requestPaint`, or other main thread tasks
        // like network events.
        if (scheduling.isInputPending!()) {
          return true;
        }
        // There's no pending input. Only yield if we've reached the max
        // yield interval.
        return currentTime >= maxYieldInterval;
      } else {
        // There's still time left in the frame.
        return false;
      }
    };
  } else {
    // `isInputPending` is not available. Since we have no way of knowing if
    // there's pending input, always yield at the end of the frame.
    shouldYieldToHost = () => performance.now() >= deadline;
  }
}

function enqueue(taskQueue: Task[], task: Task) {
  function findIndex() {
    let m = 0;
    let n = taskQueue.length - 1;

    while (m <= n) {
      const k = (n + m) >> 1;
      const cmp = task.expirationTime - taskQueue[k].expirationTime;
      if (cmp > 0) m = k + 1;
      else if (cmp < 0) n = k - 1;
      else return k;
    }
    return m;
  }
  taskQueue.splice(findIndex(), 0, task);
}

export function requestCallback(fn: () => void, options?: { timeout: number }): Task {
  if (!scheduleCallback) setupScheduler();
  let startTime = performance.now(),
    timeout = maxSigned31BitInt;

  if (options && options.timeout) timeout = options.timeout;

  const newTask: Task = {
    id: taskIdCounter++,
    fn,
    startTime,
    expirationTime: startTime + timeout,
  };

  enqueue(taskQueue, newTask);
  if (!isCallbackScheduled && !isPerformingWork) {
    isCallbackScheduled = true;
    scheduledCallback = flushWork;
    scheduleCallback!();
  }

  return newTask;
}

export function cancelCallback(task: Task) {
  task.fn = null;
}

function flushWork(hasTimeRemaining: boolean, initialTime: number) {
  // We'll need a host callback the next time work is scheduled.
  isCallbackScheduled = false;
  isPerformingWork = true;
  try {
    return workLoop(hasTimeRemaining, initialTime);
  } finally {
    currentTask = null;
    isPerformingWork = false;
  }
}

function workLoop(hasTimeRemaining: boolean, initialTime: number) {
  let currentTime = initialTime;
  currentTask = taskQueue[0] || null;
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost!())) {
      // This currentTask hasn't expired, and we've reached the deadline.
      break;
    }
    const callback = currentTask.fn;
    if (callback !== null) {
      currentTask.fn = null;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      callback(didUserCallbackTimeout);
      currentTime = performance.now();
      if (currentTask === taskQueue[0]) {
        taskQueue.shift();
      }
    } else taskQueue.shift();
    currentTask = taskQueue[0] || null;
  }
  // Return whether there's additional work
  return currentTask !== null;
}

type NodeUpdate = {
  nodeId: number;
  callbacks: Callback[];
  cancelled: boolean;
};

/**
 * Centralized scheduling for DOM updates.
 */
class Scheduler {
  #keyed = new Map<string, Callback>();
  #unkeyed: Callback[] = [];
  #nextTickCallbacks: Callback[] = [];

  #tickScheduled = false;
  #verbose = true;

  #updateQueue = new Map<number, NodeUpdate>();

  scheduleNodeUpdate(nodeId: number, fn: Callback) {
    const node = this.#updateQueue.get(nodeId);
    if (node) {
      node.callbacks.push(fn);
    } else {
      this.#updateQueue.set(nodeId, {
        nodeId,
        callbacks: [fn],
        cancelled: false,
      });
    }
    this.#requestTick();
  }

  cancelNodeUpdates(nodeId: number) {
    const node = this.#updateQueue.get(nodeId);
    if (node) node.cancelled = true;
  }

  /**
   * Registers a callback to run after all processing has finished in the next tick.
   */
  nextTick(callback: Callback) {
    this.#nextTickCallbacks.push(callback);
    this.#requestTick();
  }

  /**
   * Lets the scheduler know there is work to be done.
   */
  #requestTick() {
    if (this.#tickScheduled) return;
    queueMicrotask(this.#processTick);
    this.#tickScheduled = true;
  }

  #processTick = () => {
    const start = performance.now();
    const numKeyed = this.#keyed.size;
    const numUnkeyed = this.#unkeyed.length;
    const nodeUpdates = [...this.#updateQueue.entries()].sort((a, b) => a[0] - b[0]);

    console.log(nodeUpdates);

    for (const update of nodeUpdates) {
      if (update[1].cancelled) continue; // Skip updates that have been cancelled.
      for (const callback of update[1].callbacks) {
        callback();
      }
    }

    // Process keyed updates.
    for (const update of this.#keyed.values()) {
      update();
    }
    this.#keyed.clear();

    // Process unkeyed updates.
    for (const update of this.#unkeyed) {
      update();
    }
    this.#unkeyed.length = 0;

    // Save last tick time.
    const end = performance.now();

    if (this.#verbose) {
      console.log(
        `processed tick in ${end - start}ms (${numKeyed} keyed + ${numUnkeyed} unkeyed + ${nodeUpdates.length} nodes)`,
      );
    }

    // Process nextTick callbacks.
    for (const callback of this.#nextTickCallbacks) {
      callback();
    }
    this.#nextTickCallbacks.length = 0;

    this.#tickScheduled = false;
  };
}

export default new Scheduler();
