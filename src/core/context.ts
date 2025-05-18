import type { Dolla } from "./dolla";
import type { View } from "./nodes/view";
import type { Source } from "./signals-api";
import type { Store, StoreFunction } from "./store";

/*===========================*\
||       ElementContext      ||
\*===========================*/

export interface ElementContext {
  /**
   * The root Dolla instance this element belongs to.
   */
  root: Dolla;
  /**
   * Stores attached to this context.
   */
  stores: Map<StoreFunction<any, any>, Store<any, any>>;
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
  /**
   * Current route layer of the nearest view.
   */
  route?: Source<View<{}> | undefined>;
}

export interface ComponentContext {
  /**
   * A name for debugging purposes. Prepended to log messages.
   */
  name: string;
}

/**
 * A context capable of providing stores.
 */
export interface StoreProviderContext {
  /**
   * Attaches a new store to this context and returns it.
   */
  provide<Value>(store: StoreFunction<{}, Value>): Value;
  /**
   * Attaches a new store to this context and returns it.
   */
  provide<Value>(store: StoreFunction<undefined, Value>): Value;
  /**
   * Attaches a new store to this context and returns it.
   */
  provide<Options, Value>(store: StoreFunction<Options, Value>, options: Options): Value;
}

export interface StoreConsumerContext {
  /**
   * Gets the closest instance of a store. Throws an error if the store isn't provided higher in the tree.
   */
  get<Value>(store: StoreFunction<any, Value>): Value;
}
