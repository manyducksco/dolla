import { Emitter } from "@manyducks.co/emitter";
import type { Dolla } from "./dolla";

interface StatsStore {
  emitter: Emitter<StatsStoreEvents>;
  stats: {
    watcherCount: number;
    viewCount: number;
  };
}

type StatsStoreEvents = {
  watcherCountChanged: [watcherCount: number];
  viewCountChanged: [viewCount: number];
};

/**
 * Tracks runtime statistics.
 */
export class Stats {
  // #dolla;
  #logger;
  #store;

  constructor(dolla: Dolla) {
    // this.#dolla = dolla;
    this.#logger = dolla.createLogger("Dolla.stats");
    this.#store = _getStore();

    let timeout: any;

    this.#store.emitter.on("*", (eventName, ...args) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        this.#logger.info(this.#store.stats);
      }, 200);
    });
  }
}

/*========================*\
||   Internal Functions   ||
\*========================*/

const key = "__DOLLA_STATS_STORE__";

export function _createStore(): StatsStore {
  return {
    emitter: new Emitter<StatsStoreEvents>(),
    stats: {
      watcherCount: 0,
      viewCount: 0,
    },
  };
}

export function _getStore(): StatsStore {
  // Attempt to load/setup global store.

  if (typeof window !== "undefined") {
    if (!(window as any)[key]) {
      (window as any)[key] = _createStore();
    }
    return (window as any)[key];
  } else {
    // If we hit this, we're not in a browser. Probably server-side or a test environment.
    return _createStore();
  }
}

export function _onWatcherAdded() {
  const store = _getStore();
  store.stats.watcherCount += 1;
  store.emitter.emit("watcherCountChanged", store.stats.watcherCount);
}

export function _onWatcherRemoved() {
  const store = _getStore();
  store.stats.watcherCount -= 1;
  store.emitter.emit("watcherCountChanged", store.stats.watcherCount);
}

export function _onViewMounted() {
  const store = _getStore();
  store.stats.viewCount += 1;
  store.emitter.emit("viewCountChanged", store.stats.viewCount);
}

export function _onViewUnmounted() {
  const store = _getStore();
  store.stats.viewCount -= 1;
  store.emitter.emit("viewCountChanged", store.stats.viewCount);
}
