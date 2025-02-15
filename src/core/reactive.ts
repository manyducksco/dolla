// This system is adapted from Reactively by Milo Mighdoll under the MIT license.
// See https://github.com/milomg/reactively for the original code and extremely helpful explanatory post.

// Nodes in the reactive graph are colored using a traffic light system.
// The colors indicate what needs to happen to ensure their value is current.

const GREEN = 1; // Value has not changed. Safe to return cached value.
const YELLOW = 2; // Value may have changed. Need to check and maybe update before returning.
const RED = 3; // Value has changed. Need to update before returning.

type NodeColor = typeof GREEN | typeof YELLOW | typeof RED;

/*===================================*\
||              EFFECTS              ||
\*===================================*/

// Effects are used to track and update subscriptions.
// Effects are batched in a microtask, so it's safe to do DOM updates in subscribers.

const PENDING_EFFECTS: ReactiveNode<any>[] = [];

let flushPending = false;

function flushEffects(): void {
  if (!flushPending) {
    flushPending = true;

    queueMicrotask(() => {
      flushPending = false;
      for (let i = 0; i < PENDING_EFFECTS.length; i++) {
        PENDING_EFFECTS[i]._resolve();
      }
      PENDING_EFFECTS.length = 0;
    });
  }
}

function queueEffect(node: ReactiveNode<any>) {
  PENDING_EFFECTS.push(node);
  flushEffects();
}

function cancelEffect(node: ReactiveNode<any>) {
  PENDING_EFFECTS.splice(PENDING_EFFECTS.indexOf(node), 1);
}

/*===================================*\
||               Types               ||
\*===================================*/

/**
 * A readable reactive state object.
 */
export interface Reactive<T> {
  /**
   * The current value.
   */
  get value(): T;

  /**
   * Subscribe to receive values until unsubscribed.
   * The function is called immediately with the current value, then again each time it changes.
   */
  subscribe(callback: SubscriberCallback<T>): UnsubscribeFunction;
}

export type MaybeReactive<T> = Reactive<T> | T;

/**
 * A writable reactive state object.
 */
export interface Atom<T> extends Reactive<T> {
  set value(next: T);
}

export interface Composed<T> extends Reactive<T> {}

/**
 * Tracks a reactive as a dependency and returns its current value.
 */
export type Getter = <T>(value: MaybeReactive<T>) => T;

export type ComposeCallback<T> = (get: Getter) => T;

export type EffectCallback = (get: Getter) => void;

/*===================================*\
||             Subscriber            ||
\*===================================*/

type SubscriberCallback<T> = (value: T) => void;

export type UnsubscribeFunction = () => void;

class Subscriber<T> {
  node: ReactiveNode<T>;

  constructor(
    private source: ReactiveNode<T>,
    next: SubscriberCallback<T>,
  ) {
    this.node = new ReactiveNode<T>(new EffectDelegate((get) => next(get(source))));
    this.node._label = "SUBSCRIBER";

    // Add source to subscriber node dependencies.
    if (!this.node._parents) this.node._parents = [];
    this.node._parents.push(source);

    // Add subscriber node to source node's children.
    if (!source._children) source._children = [];
    source._children.push(this.node);

    // Add subscriber to source node's list.
    if (!source._subscribers) source._subscribers = [];
    source._subscribers.push(this);
  }

  unsubscribe() {
    // Prevent resolution, even if there were new changes pending.
    cancelEffect(this.node);

    // Remove source from node dependencies.
    remove(this.node._parents, this.source);
    // Remove subscriber node from source node's children.
    remove(this.source._children, this.node);

    // Finally, remove subscriber from source node's list.
    remove(this.source._subscribers, this);
    if (this.source._subscribers!.length === 0) this.source._subscribers = null;
  }
}

/*===================================*\
||  ReactiveNode + ReactiveDelegate  ||
\*===================================*/

// Core reactive graph logic is implemented in a ReactiveNode class. Everything is a ReactiveNode.
// Each ReactiveNode takes a delegate to customize its behavior by type; atoms, composed, effects or subscribers.

// If my understanding is right, V8 is able to optimize this better than subclasses because it's seeing
// arrays of a bunch of the same type throughout the graph, while subclasses would count as different types.

interface ReactiveDelegate<T> {
  /**
   * Called right away in the ReactiveNode's constructor.
   **/
  init(node: ReactiveNode<T>): void;

  /**
   * Called when a new value is set.
   */
  set(node: ReactiveNode<T>, next: T): void;

  /**
   * Called when node is being resolved when color is red.
   **/
  update(node: ReactiveNode<T>): void;

  /**
   * Called when the node is marked, just before the marking logic runs.
   */
  marked(node: ReactiveNode<any>, next: NodeColor, current: NodeColor): void;
}

export interface ReactiveOptions<T> {
  /**
   * A label for debugging purposes.
   */
  label?: string;

  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFunction<T>;
}

/**
 * A function to compare the current and next values. Returning `true` means the value has changed.
 */
export type EqualityFunction<T> = (current: T, next: T) => boolean;

export class ReactiveNode<T> implements Reactive<T> {
  /**
   * The latest cached value.
   */
  _value!: T;

  /**
   * Current node status. Tells how we need to handle the next attempt to access the value.
   */
  _color: NodeColor = GREEN;

  /**
   * Function to compare the current and next values.
   */
  _equals: EqualityFunction<T> = Object.is;

  /**
   * Label for debugging purposes.
   */
  _label?: string;

  /**
   * Delegate object that implements this node type's behavior.
   */
  _delegate: ReactiveDelegate<T>;

  /**
   * Nodes this node depends on.
   */
  _parents: ReactiveNode<any>[] | null = null;

  /**
   * Nodes that depend on this node.
   */
  _children: ReactiveNode<any>[] | null = null;

  /**
   * Active subscriptions to the value of this node.
   */
  _subscribers: Subscriber<T>[] | null = null;

  constructor(delegate: ReactiveDelegate<T>, options?: ReactiveOptions<T>) {
    this._delegate = delegate;
    this._delegate.init(this);

    if (options) {
      if (options.label) this._label = options.label;
      if (options.equals) this._equals = options.equals;
    }
  }

  get value() {
    this._resolve();
    return this._value;
  }

  set value(next: T) {
    this._delegate.set(this, next);
  }

  subscribe(callback: SubscriberCallback<T>): UnsubscribeFunction {
    const subscriber = new Subscriber(this, callback);
    return subscriber.unsubscribe.bind(subscriber);
  }

  /**
   * Mark children to indicate that they (may) need an update.
   * Recurses down the reactive graph. This is triggered when a node's value is updated.
   */
  _mark(color: typeof YELLOW | typeof RED) {
    if (this._color < color) {
      const oldColor = this._color;

      this._color = color;
      if (this._children) {
        for (let i = 0; i < this._children.length; i++) {
          this._children[i]._mark(YELLOW);
        }
      }

      this._delegate.marked(this, color, oldColor);
    }
  }

  /**
   * Determines if the node's value needs to be updated and performs the update if so.
   * Recurses up the reactive graph. This is triggered when a node's value is accessed.
   */
  _resolve() {
    if (this._color === YELLOW) {
      const parents = this._parents!; // There must be parents for this node to be marked YELLOW.
      for (let i = 0; i < parents.length; i++) {
        parents[i]._resolve();
        if ((this._color as NodeColor) === RED) {
          // A parent update may mark this node RED.
          // Break here to avoid unnecessary updates to other parents.
          break;
        }
      }
    }

    if (this._color === RED) {
      this._delegate.update(this);
    }

    this._color = GREEN;
  }
}

/**
 * An atom is a source value. It can be read and written. Atoms can have children but never parents.
 */
class AtomDelegate<T> implements ReactiveDelegate<T> {
  constructor(private initialValue: T) {}

  init(node: ReactiveNode<T>) {
    node._value = this.initialValue;
    node._color = GREEN;
  }

  set(node: ReactiveNode<T>, next: T) {
    if (!node._equals(node._value, next)) {
      // Mark children RED if value has changed.
      if (node._children) {
        for (let i = 0; i < node._children.length; i++) {
          node._children[i]._mark(RED);
        }
      }
      node._value = next;
    }
  }

  marked(node: ReactiveNode<any>, next: NodeColor, current: NodeColor): void {
    // no-op
  }

  update(node: ReactiveNode<T>) {
    // no-op
  }
}

/**
 * A value composed from the values of other nodes. They always have parents and may have children.
 * Composed values cannot be directly set.
 */
class ComposedDelegate<T> implements ReactiveDelegate<T> {
  constructor(private composer: ComposeCallback<T>) {}

  init(node: ReactiveNode<T>) {
    // Value will be computed before it is accessed. Undefined for now.
    node._value = undefined as T;
    node._color = RED;
  }

  set(node: ReactiveNode<T>, next: T) {
    throw new Error(`Composed values are read only.`);
  }

  marked(node: ReactiveNode<any>, next: NodeColor, current: NodeColor): void {
    // no-op
  }

  update(node: ReactiveNode<T>) {
    const oldValue = node._value;

    try {
      const [tracked, value] = track(this.composer);
      node._value = value;
      updateParents(node, tracked);
    } catch (error) {
      console.error(error);
      // TODO: Handle error.
    }

    node._color = GREEN;

    // Mark immediate children RED if value has changed.
    if (!node._equals(oldValue, node._value)) {
      if (node._children) {
        for (let i = 0; i < node._children.length; i++) {
          node._children[i]._color = RED;
        }
      }
    }
  }
}

/**
 * An effect uses a callback to track parent values, but doesn't store its own value and has no children.
 * This node type exists to run logic outside the reactive graph in response to node value changes within.
 */
class EffectDelegate implements ReactiveDelegate<any> {
  constructor(private callback: EffectCallback) {}

  init(node: ReactiveNode<any>) {
    node._color = RED;
    node._resolve();
  }

  set() {
    throw new Error("Effect nodes cannot be set.");
  }

  marked(node: ReactiveNode<any>, next: NodeColor, current: NodeColor): void {
    // Queue effect when changing from green.
    if (current === GREEN) {
      queueEffect(node);
    }
  }

  update(node: ReactiveNode<any>) {
    try {
      const [tracked] = track(this.callback);
      updateParents(node, tracked);
    } catch (error) {
      console.error(error);
      // TODO: Handle error.
    }

    node._color = GREEN;
  }
}

/*===================================*\
||         Utility Functions         ||
\*===================================*/

/**
 * Mutates an array to remove an item. No-op if the array is null.
 */
function remove<T>(array: T[] | null, value: T) {
  if (array) {
    array.splice(array.indexOf(value), 1);
  }
}

/**
 * Runs a composer or effect callback. Returns the list of tracked nodes and the callback's return value.
 */
function track<T>(fn: ComposeCallback<T>): [ReactiveNode<any>[], T] {
  const tracked = new Set<ReactiveNode<any>>();
  const getter: Getter = (reactive) => {
    if (reactive instanceof ReactiveNode) {
      tracked.add(reactive);
      return reactive.value;
    } else {
      // Return the value without tracking if it's not reactive.
      return reactive;
    }
  };

  const value = fn(getter);

  return [Array.from(tracked.values()), value];
}

/**
 * Implements the procedure of linking and unlinking from parent nodes when tracked values have changed.
 */
function updateParents(node: ReactiveNode<any>, newParents: ReactiveNode<any>[]) {
  if (node._parents) {
    // Remove ourselves from old parents' child arrays
    for (let d = 0; d < node._parents.length; d++) {
      const dependency = node._parents[d];
      let isTracked = false;
      for (let t = 0; t < newParents.length; t++) {
        if (dependency === newParents[t]) {
          isTracked = true;
          break;
        }
      }
      if (!isTracked) {
        remove(dependency._children, node);
      }
    }

    // Add ourselves to new parents' child arrays
    for (let t = 0; t < newParents.length; t++) {
      const dependency = newParents[t];
      let wasTracked = false;
      for (let d = 0; d < node._parents.length; d++) {
        if (dependency === node._parents[d]) {
          wasTracked = true;
          break;
        }
      }
      if (!wasTracked) {
        if (!dependency._children) {
          dependency._children = [node];
        } else {
          dependency._children.push(node);
        }
      }
    }
  } else {
    // Add ourselves to new parents' child arrays
    for (let i = 0; i < newParents.length; i++) {
      const dependency = newParents[i];
      if (!dependency._children) {
        dependency._children = [node];
      } else {
        dependency._children.push(node);
      }
    }
  }
  node._parents = newParents;
}

/*===================================*\
||        Public API Functions       ||
\*===================================*/

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be accessed with the `value` property or subscribed to with the `subscribe` method.
 *
 * @example
 * const count = atom(1);
 * count.value++;
 * count.value; // 2
 *
 * const unsubscribe = count.subscribe((value) => {
 *   console.log('count is now %d', value);
 * });
 * unsubscribe();
 */
export function atom<T>(): Atom<T | undefined>;

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be accessed with the `value` property or subscribed to with the `subscribe` method.
 *
 * @example
 * const count = atom(1);
 * count.value++;
 * count.value; // 2
 *
 * const unsubscribe = count.subscribe((value) => {
 *   console.log('count is now %d', value);
 * });
 * unsubscribe();
 */
export function atom<T>(value: T, options?: ReactiveOptions<T>): Atom<T>;

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be accessed with the `value` property or subscribed to with the `subscribe` method.
 *
 * @example
 * const count = atom(1);
 * count.value++;
 * count.value; // 2
 *
 * const unsubscribe = count.subscribe((value) => {
 *   console.log('count is now %d', value);
 * });
 * unsubscribe();
 */
export function atom<T>(value?: T, options?: ReactiveOptions<T>): Atom<T | undefined>;

export function atom<T>(value?: T, options?: ReactiveOptions<T>) {
  return new ReactiveNode(new AtomDelegate<T>(value as T), options);
}

/**
 * Creates a reactive container that derives its value from other reactive values.
 * The callback takes a `get` function that will track a dependency and return its value.
 *
 * @example
 * const count = atom(1);
 * const doubled = compose(get => get(count) * 2);
 */
export function compose<T>(callback: ComposeCallback<T>, options?: ReactiveOptions<T>): Composed<T> {
  return new ReactiveNode(new ComposedDelegate<T>(callback), options);
}

/**
 * Unwraps a (possibly) reactive value to a plain value.
 *
 * @example
 * const count = atom(1);
 * const value = unwrap(count); // 1
 *
 * const value = unwrap(5); // 5
 */
export function unwrap<T>(value: MaybeReactive<T>): T {
  if (value instanceof ReactiveNode) {
    return value.value;
  } else {
    return value as T;
  }
}

/**
 * Determines if a value is reactive.
 */
export function isReactive<T>(value: any): value is Reactive<T> {
  return value instanceof ReactiveNode;
}
