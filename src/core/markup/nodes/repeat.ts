import type { Renderable } from "../../../types.js";
import type { Context } from "../../context.js";
import { batch, type Getter, createAtom, subscribe, type Setter } from "../../signals.js";
import { flushPendingUpdates, scheduleUpdate } from "../scheduler.js";
import { MarkupNode } from "../types.js";
import { addChild, createTextNode, render } from "../utils.js";

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
};

// ----- Code ----- //

/**
 * Renders a list of items.
 */
export class RepeatNode<T> extends MarkupNode {
  #root = createTextNode("");

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
    return this.#root.parentNode != null;
  }

  override mount(parent: Element, after?: Node) {
    if (!this.isMounted()) {
      addChild(parent, this.#root, after);

      this.#unsubscribe = subscribe(this.#items, (items) => {
        scheduleUpdate(() => {
          this._update(Array.from(items));
        });
      });
      flushPendingUpdates();
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
    let referenceNode: Node | null = after?.nextSibling ?? null;

    if (parent.moveBefore) {
      try {
        parent.moveBefore(this.#root, referenceNode);
        referenceNode = this.#root.nextSibling;

        for (const connected of this.#connectedItems.values()) {
          const childRoot = connected._node.getRoot();
          if (childRoot) {
            (parent as any).moveBefore(childRoot, referenceNode);
          }
        }
        return;
      } catch {}
    }

    parent.insertBefore(this.#root, referenceNode);
    referenceNode = this.#root.nextSibling;

    for (const connected of this.#connectedItems.values()) {
      connected._node.move(parent, referenceNode ?? undefined);
      const childRoot = connected._node.getRoot();
      if (childRoot) referenceNode = childRoot;
    }
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
      // Prepare state and allocate new nodes.
      for (let i = 0; i < value.length; i++) {
        const itemVal = value[i];
        const key = this.#key(itemVal, i);
        let connected = this.#connectedItems.get(key);

        if (connected) {
          connected._setItem(itemVal);
          connected._setIndex(i);
        } else {
          const [_item, _setItem] = createAtom(itemVal);
          const [_index, _setIndex] = createAtom(i);

          const renderContent = this.#render(
            () => _item(),
            () => _index(),
          );
          const _node = render(renderContent, this.#context);

          connected = {
            _key: key,
            _node,
            _item,
            _setItem,
            _index,
            _setIndex,
          };
        }
        nextItems.set(key, connected);
      }

      // Unmount deleted items using the new key map for O(1) lookup.
      for (const [key, connected] of this.#connectedItems.entries()) {
        if (!nextItems.has(key)) {
          connected._node.unmount(false);
        }
      }
    });

    this.#connectedItems = nextItems;

    // Forward pass to insert or move nodes.
    const parent = this.#root.parentElement!;
    let referenceNode: Node = this.#root;

    for (const connected of this.#connectedItems.values()) {
      const expectedNext = referenceNode.nextSibling;

      if (!connected._node.isMounted()) {
        connected._node.mount(parent, referenceNode);
      } else if (connected._node.getRoot() !== expectedNext) {
        connected._node.move(parent, referenceNode);
      }

      referenceNode = connected._node.getRoot()!;
    }
  }
}
