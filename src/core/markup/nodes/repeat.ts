import type { Renderable } from "../../../types.js";
import type { Context } from "../../context.js";
import { batch, type Getter, createAtom, type Setter } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { getDebug } from "../../debug.js";
import type { MarkupNode, MountTarget } from "../types.js";
import { lastNodeOf, moveChildrenAfter, render } from "../utils.js";
import { AnchoredNode } from "./anchored.js";

// ----- Types ----- //

export type Key = any;

export type KeyFn<T> = (item: T, index: number) => Key;
export type RenderFn<T> = (item: Getter<T>, index: Getter<number>) => Renderable;

type ConnectedItem<T> = {
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
export class RepeatNode<T> extends AnchoredNode<Iterable<T>> {
  #key: KeyFn<T>;
  #render: RenderFn<T>;

  #connectedItems: Map<Key, ConnectedItem<T>> = new Map();
  /** Nodes of the connected items, in rendered order. */
  #nodes: MarkupNode[] = [];

  constructor(context: Context, items: Getter<Iterable<T>>, key: KeyFn<T>, render: RenderFn<T>) {
    super(context, items, "RepeatNode", "repeat:items");
    this.#key = key;
    this.#render = render;
  }

  override getLastNode() {
    return lastNodeOf(this.#nodes, this.getRoot() ?? null);
  }

  protected override moveContent(parent: MountTarget, anchor: Node) {
    moveChildrenAfter(parent, anchor, this.#nodes);
  }

  protected override clear(skipDOM: boolean) {
    // Removing many items from the page one at a time is slow. Instead they are
    // torn down with their DOM left in place, and then everything between the
    // anchor and the node that followed the last item is removed in one step.
    const anchor = this.anchor;
    const parent = anchor?.parentNode;
    let last: Node | undefined;
    let end: Node | null = null;
    let bulk = false;

    if (!skipDOM && parent && this.#nodes.length > 1) {
      last = this.getLastNode();
      if (last && last !== anchor && last.parentNode === parent) {
        bulk = true;
        end = last.nextSibling;
      }
    }

    const info = { phase: "unmount", context: this.context } as const;
    for (const item of this.#connectedItems.values()) {
      runSafely(() => item._node.unmount(bulk || skipDOM), info);
    }
    this.#connectedItems.clear();
    this.#nodes = [];

    if (!bulk || anchor!.parentNode !== parent) return;

    const range = document.createRange();
    range.selectNodeContents(parent!);
    range.setStartAfter(anchor!);
    if (end) {
      // The list ends before `end`. A cleanup callback may have removed that
      // node, or the last node of the list, so use whichever is still in place.
      if (end.parentNode === parent) range.setEndBefore(end);
      else if (last!.parentNode === parent) range.setEndAfter(last!);
      else return;
    }
    range.deleteContents();
  }

  protected override update(iterable: Iterable<T>) {
    if (iterable === undefined) return;
    const value = Array.from(iterable);

    if (value.length === 0) {
      return this.clear(false);
    }

    const nextItems = new Map<Key, ConnectedItem<T>>();
    // Whether an item was created, and whether a kept item now comes before one it used to follow.
    let created = false;
    let moved = false;
    let lastOrder = -1;

    batch(() => {
      // Prepare state and allocate new nodes.
      for (let i = 0; i < value.length; i++) {
        const itemVal = value[i];
        const key = this.#key(itemVal, i);

        if (nextItems.has(key)) {
          // Only the first item with a given key is rendered.
          getDebug(this.context).warn(`repeat: duplicate key at index ${i} was skipped`, key);
          continue;
        }

        let connected = this.#connectedItems.get(key);

        if (connected) {
          if (connected._order <= lastOrder) moved = true;
          lastOrder = connected._order;
          connected._setItem(itemVal);
          connected._setIndex(i);
        } else {
          created = true;
          const [_item, _setItem] = createAtom(itemVal);
          const [_index, _setIndex] = createAtom(i);

          const renderContent = this.#render(_item, _index);
          const _node = render(renderContent, this.context);

          connected = {
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
            context: this.context,
          });
        }
      }
    });

    const items = Array.from(nextItems.values());
    this.#connectedItems = nextItems;
    this.#nodes = items.map((connected) => connected._node);

    const parent = this.anchor!.parentNode as MountTarget | null;
    if (!parent) return;

    if (!moved) {
      // The kept items are still in order, so the only DOM work is mounting new ones.
      let referenceNode: Node = this.anchor!;
      for (let i = 0; i < items.length; i++) {
        const connected = items[i];
        if (connected._order === -1) connected._node.mount(parent, referenceNode);
        connected._order = i;
        if (created) referenceNode = connected._node.getLastNode() ?? referenceNode;
      }
      return;
    }

    const stable = findStableItems(items);

    // Forward pass to insert or move nodes. Items in the stable set keep their
    // relative order, so only the others need to move.
    let referenceNode: Node = this.anchor!;

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
