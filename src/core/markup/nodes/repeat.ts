import type { Renderable } from "../../../types.js";
import type { Context } from "../../context.js";
import { batch, type Getter, createAtom, subscribe, type Setter, withoutOwner } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { getDebug } from "../../debug.js";
import { flushPendingUpdates, runUpdate, scheduleUpdate, type UpdateMeta } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, moveAfter, render } from "../utils.js";

// ----- Types ----- //

export type Key = any;

export type KeyFn<T> = (item: T, index: number) => Key;
export type RenderFn<T> = (item: Getter<T>, index: Getter<number>) => Renderable;

type ConnectedItem<T> = {
  _key: Key;
  _item: Getter<T>;
  _setItem: Setter<T>;
  _index: Getter<number>;
  _setIndex: Setter<number>;
  _node: MarkupNode;
  /** Position in the most recently rendered order. */
  _order: number;
};

// ----- Code ----- //

/**
 * Renders a list of items.
 */
export class RepeatNode<T> extends MarkupNode {
  #root: Text | null = null;

  #context;

  #items: Getter<Iterable<T>>;
  #key: KeyFn<T>;
  #render: RenderFn<T>;

  #unsubscribe: (() => void) | null = null;
  #connectedItems: Map<Key, ConnectedItem<T>> = new Map();
  #pendingItems?: Iterable<T>;
  readonly #meta: UpdateMeta;

  constructor(context: Context, items: Getter<Iterable<T>>, key: KeyFn<T>, render: RenderFn<T>) {
    super();
    this.#context = context;

    this.#items = items;
    this.#key = key;
    this.#render = render;
    this.#meta = { label: "RepeatNode", context };
  }

  #updatePending = () => {
    const items = this.#pendingItems;
    this.#pendingItems = undefined;
    if (items !== undefined) this._update(Array.from(items));
  };

  override getRoot() {
    return this.#root ?? undefined;
  }

  override getLastNode() {
    let last: Node | undefined;
    for (const connected of this.#connectedItems.values()) {
      last = connected._node.getLastNode() ?? last;
    }
    return last ?? this.#root ?? undefined;
  }

  override isMounted() {
    return this.#root?.parentNode != null;
  }

  override mount(parent: Element, after?: Node | null) {
    if (!this.isMounted()) {
      this.#root = createTextNode("");
      addChild(parent, this.#root, after);

      let initial = true;
      let hasInitial = false;
      this.#unsubscribe = withoutOwner(() =>
        subscribe(
          this.#items,
          (items) => {
            this.#pendingItems = items;
            if (initial) {
              hasInitial = true;
              return;
            }
            scheduleUpdate(this.#updatePending, this.#meta);
          },
          { name: "repeat:items", context: this.#context },
        ),
      );
      initial = false;
      // Apply the initial value after the subscription is registered so the
      // node can be safely torn down from inside its own items.
      if (hasInitial) runUpdate(this.#updatePending, this.#meta);
      flushPendingUpdates();
    }
  }

  override unmount(skipDOM = false) {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }

    if (!skipDOM && this.isMounted()) {
      this.#root!.parentNode?.removeChild(this.#root!);
    }

    this._cleanup(skipDOM);
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#root) return;

    moveAfter(parent, this.#root, after);

    let ref: Node = this.#root;
    for (const connected of this.#connectedItems.values()) {
      connected._node.move(parent, ref);
      ref = connected._node.getLastNode() ?? ref;
    }
  }

  private _cleanup(skipDOM: boolean) {
    for (const item of this.#connectedItems.values()) {
      runSafely(() => item._node.unmount(skipDOM), {
        phase: "unmount",
        context: this.#context,
      });
    }
    this.#connectedItems.clear();
  }

  private _update(value: T[]) {
    if (!this.isMounted() || !this.#root) return;

    if (value.length === 0) {
      return this._cleanup(false);
    }

    const nextItems = new Map<Key, ConnectedItem<T>>();

    batch(() => {
      // Prepare state and allocate new nodes.
      for (let i = 0; i < value.length; i++) {
        const itemVal = value[i];
        const key = this.#key(itemVal, i);

        if (nextItems.has(key)) {
          // Only the first item with a given key is rendered.
          getDebug(this.#context).warn(`repeat: duplicate key at index ${i} was skipped`, key);
          continue;
        }

        let connected = this.#connectedItems.get(key);

        if (connected) {
          connected._setItem(itemVal);
          connected._setIndex(i);
        } else {
          const [_item, _setItem] = createAtom(itemVal);
          const [_index, _setIndex] = createAtom(i);

          const renderContent = this.#render(_item, _index);
          const _node = render(renderContent, this.#context);

          connected = {
            _key: key,
            _node,
            _item,
            _setItem,
            _index,
            _setIndex,
            _order: -1,
          };
        }
        nextItems.set(key, connected);
      }

      // Unmount deleted items using the new key map for O(1) lookup.
      for (const [key, connected] of this.#connectedItems.entries()) {
        if (!nextItems.has(key)) {
          runSafely(() => connected._node.unmount(false), {
            phase: "unmount",
            context: this.#context,
          });
        }
      }
    });

    this.#connectedItems = nextItems;

    const parent = this.#root.parentNode as MountTarget | null;
    if (!parent) return;

    const items = Array.from(nextItems.values());
    const stable = findStableItems(items);

    // Forward pass to insert or move nodes. Items in the stable set keep their
    // relative order, so only the others need to move.
    let referenceNode: Node = this.#root;

    for (let i = 0; i < items.length; i++) {
      const connected = items[i];
      connected._order = i;

      if (!connected._node.isMounted()) {
        connected._node.mount(parent, referenceNode);
      } else if (!stable[i] && connected._node.getRoot() !== referenceNode.nextSibling) {
        connected._node.move(parent, referenceNode);
      }

      referenceNode = connected._node.getLastNode() ?? referenceNode;
    }
  }
}

/**
 * Marks the items that can stay where they are: the longest run of previously
 * rendered items whose old order is still increasing in the new order. Every
 * other item is new or must be moved. O(n log n).
 */
function findStableItems(items: { _order: number }[]): boolean[] {
  const n = items.length;
  const stable = new Array<boolean>(n).fill(false);

  // Fast path: nothing was reordered (appends, removals, in-place updates).
  let last = -1;
  let ordered = true;
  for (let i = 0; i < n; i++) {
    const order = items[i]._order;
    if (order === -1) continue;
    if (order < last) {
      ordered = false;
      break;
    }
    last = order;
  }
  if (ordered) return stable.fill(true);

  // Longest increasing subsequence of old orders, tracking predecessors.
  const tails: number[] = []; // index into items of the smallest tail for each length
  const prev = new Int32Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const order = items[i]._order;
    if (order === -1) continue;

    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[tails[mid]]._order < order) lo = mid + 1;
      else hi = mid;
    }

    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }

  for (let i = tails.length ? tails[tails.length - 1] : -1; i !== -1; i = prev[i]) {
    stable[i] = true;
  }
  return stable;
}
