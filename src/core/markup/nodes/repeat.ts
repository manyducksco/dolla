import type { Renderable } from "../../../types.js";
import { addChild } from "../../../utils.js";
import type { Context } from "../../context.js";
import { batch, Getter, state, subscribe, type Accessor } from "../../signals.js";
import { scheduleUpdate } from "../scheduler.js";
import { MarkupNode } from "../types.js";
import { render } from "../utils.js";

// ----- Types ----- //

export type Key = any;

export type KeyFn<T> = (item: T, index: number) => Key;
export type RenderFn<T> = (item: Getter<T>, index: Getter<number>) => Renderable;

type ConnectedItem<T> = {
  _key: Key;
  _item: Accessor<T>;
  _index: Accessor<number>;
  _node: MarkupNode;
};

// ----- Code ----- //

/**
 * Renders a list of items.
 */
export class RepeatNode<T> extends MarkupNode {
  #root = document.createTextNode("");

  #context;

  #items: Getter<Iterable<T>>;
  #key: KeyFn<T>;
  #render: RenderFn<T>;

  #unsubscribe: (() => void) | null = null;
  #connectedItems: Map<Key, ConnectedItem<T>> = new Map();

  constructor(context: Context, items: Getter<Iterable<T>>, key: KeyFn<T>, render: RenderFn<T>) {
    super();
    this.#context = context;

    this.#items = items;
    this.#key = key;
    this.#render = render;
  }

  override getRoot() {
    return this.#root;
  }

  override isMounted() {
    return this.#root.parentElement != null;
  }

  override mount(parent: Element, after?: Node) {
    if (!this.isMounted()) {
      addChild(parent, this.#root, after);

      this.#unsubscribe = subscribe(this.#items, (items) => {
        scheduleUpdate(() => {
          this._update(Array.from(items));
        });
      });
    }
  }

  override unmount(skipDOM = false) {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }

    if (!skipDOM && this.isMounted()) {
      this.#root.parentNode?.removeChild(this.#root);
    }

    this._cleanup(skipDOM);
  }

  override move(parent: Element, after?: Node) {
    // TODO: Implement move
    return this.mount(parent, after);
  }

  private _cleanup(skipDOM: boolean) {
    for (const item of this.#connectedItems.values()) {
      item._node.unmount(skipDOM);
    }
    this.#connectedItems.clear();
  }

  private _update(value: T[]) {
    if (!this.isMounted()) return;

    if (value.length === 0) {
      return this._cleanup(false);
    }

    const nextItems = new Map<Key, ConnectedItem<T>>();

    batch(() => {
      // Track keys for the incoming list
      const nextKeys = new Set(value.map((item, index) => this.#key(item, index)));

      // Unmount deleted items immediately.
      // This collapses the DOM tree so surviving items sit adjacent to each other.
      for (const [key, connected] of this.#connectedItems.entries()) {
        if (!nextKeys.has(key)) {
          connected._node.unmount(false);
        }
      }

      // Prepare state and allocate new nodes.
      for (let i = 0; i < value.length; i++) {
        const itemVal = value[i];
        const key = this.#key(itemVal, i);
        let connected = this.#connectedItems.get(key);

        if (connected && nextKeys.has(key)) {
          connected._item(itemVal);
          connected._index(i);
        } else {
          const item = state(itemVal);
          const index = state(i);

          const renderContent = this.#render(
            () => item(),
            () => index(),
          );
          const node = render(renderContent, this.#context);

          connected = { _key: key, _item: item, _index: index, _node: node };
        }
        nextItems.set(key, connected);
      }
    });

    this.#connectedItems = nextItems;

    // Forward pass to insert or move nodes.
    const parent = this.#root.parentElement!;
    let referenceNode: Node = this.#root;

    for (const connected of this.#connectedItems.values()) {
      const expectedNext = referenceNode.nextSibling;

      if (!connected._node.isMounted()) {
        // Node is new. Mount it exactly at the current cursor.
        connected._node.mount(parent, referenceNode);
      } else if (connected._node.getRoot() !== expectedNext) {
        // Node is out of order. Move it.
        connected._node.move(parent, referenceNode);
      }

      // Advance the cursor.
      referenceNode = connected._node.getRoot()!;
    }
  }
}
