import type { Renderable } from "../../../types.js";
import type { Context } from "../../context.js";
import { batch, Getter, Setter, state, subscribe, type UnsubscribeFn } from "../../reactive.js";
import { scheduleUpdate } from "../scheduler.js";
import { MarkupNode } from "../types.js";
import { toMarkupNodes } from "../utils.js";
import { DynamicNode } from "./dynamic.js";

// ----- Types ----- //

export type Key = any;

export type KeyFn<T> = (item: T, index: number) => Key;
export type RenderFn<T> = (item: Getter<T>, index: Getter<number>) => Renderable;

type ConnectedItem<T> = {
  key: Key;
  item: Getter<T>;
  setItem: Setter<T>;
  index: Getter<number>;
  setIndex: Setter<number>;
  node: MarkupNode;
};

// ----- Code ----- //

/**
 * Renders a list of items.
 */
export class RepeatNode<T> extends MarkupNode {
  private root = document.createTextNode("");

  private context;

  private items: Getter<Iterable<T>>;
  private key: KeyFn<T>;
  private render: RenderFn<T>;

  private unsubscribe: UnsubscribeFn | null = null;
  private connectedItems: Map<Key, ConnectedItem<T>> = new Map();

  constructor(context: Context, items: Getter<Iterable<T>>, key: KeyFn<T>, render: RenderFn<T>) {
    super();
    this.context = context;

    this.items = items;
    this.key = key;
    this.render = render;
  }

  override getRoot() {
    return this.root;
  }

  override isMounted() {
    return this.root.parentElement != null;
  }

  override mount(parent: Element, after?: Node) {
    if (!this.isMounted()) {
      parent.insertBefore(this.root, after?.nextSibling ?? null);

      this.unsubscribe = subscribe(this.items, (items) => {
        scheduleUpdate(() => {
          this._update(Array.from(items));
        });
      });
    }
  }

  override unmount(skipDOM = false) {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (!skipDOM && this.isMounted()) {
      this.root.parentNode?.removeChild(this.root);
    }

    this._cleanup(skipDOM);
  }

  override move(parent: Element, after?: Node) {
    // TODO: Implement move
    return this.mount(parent, after);
  }

  private _cleanup(skipDOM: boolean) {
    for (const item of this.connectedItems.values()) {
      item.node.unmount(skipDOM);
    }
    this.connectedItems.clear();
  }

  private _update(value: T[]) {
    if (!this.isMounted()) return;

    if (value.length === 0) {
      return this._cleanup(false);
    }

    const nextItems = new Map<Key, ConnectedItem<T>>();

    batch(() => {
      // Track keys for the incoming list
      const nextKeys = new Set(value.map((item, index) => this.key(item, index)));

      // Unmount deleted items immediately.
      // This collapses the DOM tree so surviving items sit adjacent to each other.
      for (const [key, connected] of this.connectedItems.entries()) {
        if (!nextKeys.has(key)) {
          connected.node.unmount(false);
        }
      }

      // Prepare state and allocate new nodes.
      for (let i = 0; i < value.length; i++) {
        const itemVal = value[i];
        const key = this.key(itemVal, i);
        let connected = this.connectedItems.get(key);

        if (connected && nextKeys.has(key)) {
          connected.setItem(itemVal);
          connected.setIndex(i);
        } else {
          const [item, setItem] = state(itemVal);
          const [index, setIndex] = state(i);

          const rendered = this.render(item, index);

          const nodes = toMarkupNodes(this.context, [rendered]);
          const node = nodes.length === 1 ? nodes[0] : new DynamicNode(this.context, () => nodes);

          connected = { key, item, setItem, index, setIndex, node };
        }
        nextItems.set(key, connected);
      }
    });

    this.connectedItems = nextItems;

    // Forward pass to insert or move nodes.
    const parent = this.root.parentElement!;
    let referenceNode: Node = this.root;

    for (const connected of this.connectedItems.values()) {
      const expectedNext = referenceNode.nextSibling;

      if (!connected.node.isMounted()) {
        // Node is new. Mount it exactly at the current cursor.
        connected.node.mount(parent, referenceNode);
      } else if (connected.node.getRoot() !== expectedNext) {
        // Node is out of order. Move it.
        connected.node.move(parent, referenceNode);
      }

      // Advance the cursor.
      referenceNode = connected.node.getRoot()!;
    }
  }
}
