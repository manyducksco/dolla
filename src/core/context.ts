import type { Emitter } from "@manyducks.co/emitter";
import type { Store, StoreFactory } from "./store";
import type { Dolla } from "./dolla";

/*===========================*\
||       ElementContext      ||
\*===========================*/

interface ContextEmitterEvents {
  [eventName: string | symbol]: [ContextEvent<any>];
}

export interface ElementContext {
  /**
   * The root Dolla instance this element belongs to.
   */
  root: Dolla;
  /**
   * Storage for context variables.
   */
  data: Record<string | symbol, unknown>;
  /**
   * Event emitter for this context.
   */
  emitter: Emitter<ContextEmitterEvents>;
  /**
   * Stores attached to this context.
   */
  stores: Map<string, Store<any, any>>;
  /**
   * A reference to the parent context.
   */
  parent?: ElementContext;
  /**
   * Whether to create DOM nodes in the SVG namespace. An `<svg>` element will set this to true and pass it down to children.
   */
  isSVG?: boolean;
  /**
   * The name of the nearest parent view.
   */
  viewName?: string;
}

export interface ComponentContext {
  /**
   * Sets a context variable and returns its value.
   */
  set<T>(key: string | symbol, value: T): T;

  /**
   * Gets the value of a context variable. Returns null if the variable is not set.
   */
  get<T>(key: string | symbol): T | null;

  /**
   * Adds a listener to be called when `eventName` is emitted.
   */
  on<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void;

  /**
   * Removes a listener from the list to be called when `eventName` is emitted.
   */
  off<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void;

  /**
   * Adds a listener to be called when `eventName` is emitted. The listener is immediately removed after being called once.
   */
  once<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void;

  /**
   * Emits a new event to all listeners.
   */
  emit<T = unknown>(eventName: string, detail: T): boolean;
}

/**
 * A context capable of hosting stores.
 */
export interface StorableContext extends ComponentContext {
  /**
   * Attaches a new store to this context.
   */
  attachStore(store: Store<any, any>): void;

  /**
   * Gets the closest instance of a store. Throws an error if the store isn't provided higher in the tree.
   */
  useStore<Value>(factory: StoreFactory<any, Value>): Value;
}

/**
 * An event emitted from and received by a Dolla context. These are separate from DOM events.
 */
export class ContextEvent<T> {
  type: string;
  detail: T;

  #propagationStopped = false;

  get propagationStopped() {
    return this.#propagationStopped;
  }

  constructor(type: string, detail: T) {
    this.type = type;
    this.detail = detail;
  }

  stopPropagation() {
    this.#propagationStopped = true;
  }

  get [Symbol.toStringTag]() {
    return "ContextEvent";
  }

  // stopImmediatePropagation() {}
}
