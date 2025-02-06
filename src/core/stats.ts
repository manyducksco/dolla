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
  /**
   * Emitted when any stats are updated in the store.
   */
  statsChanged: [];

  _incrementWatcherCount: [amount: number];
  _incrementViewCount: [amount: number];
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

    this.#store.emitter.on("statsChanged", () => {
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

const key = Symbol.for("DollaStatsStore");

export function _createStore(): StatsStore {
  const emitter = new Emitter<StatsStoreEvents>();
  const stats = {
    watcherCount: 0,
    viewCount: 0,
  };

  emitter.on("_incrementViewCount", (amount) => {
    stats.viewCount += amount;
    emitter.emit("statsChanged");
  });

  emitter.on("_incrementWatcherCount", (amount) => {
    stats.watcherCount += amount;
    emitter.emit("statsChanged");
  });

  return { emitter, stats };
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
  _getStore().emitter.emit("_incrementWatcherCount", 1);
}

export function _onWatcherRemoved() {
  _getStore().emitter.emit("_incrementWatcherCount", -1);
}

export function _onViewMounted() {
  _getStore().emitter.emit("_incrementViewCount", 1);
}

export function _onViewUnmounted() {
  _getStore().emitter.emit("_incrementViewCount", -1);
}
