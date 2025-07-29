import type { Renderable } from "../../types.js";
import { deepEqual } from "../../utils.js";
import type { Context } from "../context.js";
import { batch, effect, untracked, writable, type Signal, type UnsubscribeFn, type Writable } from "../signals.js";
import { MarkupNode } from "./_markup.js";
import { ViewNode } from "./view.js";

// ----- Types ----- //

export type Key = any;

export type KeyFn<T> = (item: T, index: number) => Key;
export type RenderFn<T> = (item: Signal<T>, index: Signal<number>, ctx: Context) => Renderable;

type ConnectedItem<T> = {
  key: Key;
  item: Writable<T>;
  index: Writable<number>;
  node: MarkupNode;
};

// ----- Code ----- //

/**
 * Renders a list of items.
 */
export class RepeatNode<T> extends MarkupNode {
  private root = document.createTextNode("");

  private context;

  private items: Signal<T[]>;
  private key: KeyFn<T>;
  private render: RenderFn<T>;

  private unsubscribe: UnsubscribeFn | null = null;
  private connectedItems: Map<Key, ConnectedItem<T>> = new Map();

  constructor(context: Context, items: Signal<T[]>, key: KeyFn<T>, render: RenderFn<T>) {
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

      this.unsubscribe = effect(() => {
        let value = this.items();

        if (value == null) {
          value = [];
          this.context.warn("repeat() received empty value for items", value);
        }

        untracked(() => {
          this._update(Array.from(value));
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

    this._cleanup(true);
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
    if (value.length === 0 || !this.isMounted()) {
      return this._cleanup(false);
    }

    type UpdateItem = { key: Key; value: T; index: number };

    const potentialItems = new Map<Key, UpdateItem>();
    let index = 0;

    for (const item of value) {
      const key = this.key(item, index);
      potentialItems.set(key, {
        key,
        value: item,
        index: index++,
      });
    }

    const newItems: ConnectedItem<T>[] = [];

    // Remove views for items that no longer exist in the new list.
    for (const connected of this.connectedItems.values()) {
      if (!potentialItems.has(connected.key) && connected.node.isMounted()) {
        connected.node.unmount(false);
      }
    }

    batch(() => {
      // Add new views and update state for existing ones.
      for (const potential of potentialItems.values()) {
        const connected = this.connectedItems.get(potential.key);

        if (connected && connected.node.isMounted()) {
          connected.item.set(potential.value);
          connected.index.set(potential.index);

          newItems[potential.index] = connected;
        } else {
          // deepEqual avoids running update code again if the data is equivalent. In list updates this happens a lot.
          const item = writable(potential.value, { equals: deepEqual });
          const index = writable(potential.index);

          newItems[potential.index] = {
            key: potential.key,
            item,
            index,
            node: new ViewNode(this.context, RepeatItemView, {
              item: () => item(),
              index: () => index(),
              render: this.render,
            }),
          };
        }
      }
    });

    // Reconnect to ensure order. Lifecycle hooks won't be run again if the view is already connected.
    // TODO: Use a smarter inline reordering method. This causes scrollbars to jump.
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const previous = newItems[i - 1]?.node.getRoot() ?? this.root;

      const connected = this.connectedItems.get(item.key);
      if (connected && connected.node.isMounted()) {
        item.node.move(this.root.parentElement!, previous);
      } else {
        item.node.mount(this.root.parentElement!, previous);
      }
    }

    this.connectedItems.clear();
    for (const item of newItems) {
      this.connectedItems.set(item.key, item);
    }

    // Move marker node to end.
    const lastItem = newItems.at(-1)?.node.getRoot() ?? this.root;
    this.root.parentNode?.insertBefore(this.root, lastItem.nextSibling);
  }
}

interface ListItemProps {
  item: Signal<any>;
  index: Signal<number>;
  render: (item: Signal<any>, index: Signal<number>, context: Context) => Renderable;
}
const contextName = "dolla.RepeatItemView";
function RepeatItemView(props: ListItemProps, context: Context) {
  context.setName(contextName);
  return props.render.call(context, props.item, props.index, context);
}
