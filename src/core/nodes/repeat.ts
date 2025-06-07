import type { Renderable } from "../../types.js";
import { deepEqual } from "../../utils.js";
import type { Context } from "../context.js";
import type { MarkupNode } from "../markup.js";
import { $, effect, peek, type Signal, type Source, type UnsubscribeFn } from "../signals.js";
import { IS_MARKUP_NODE } from "../symbols.js";
import { ViewInstance } from "./view.js";

// ----- Types ----- //

export type KeyFn<T> = (item: T, index: number) => string | number | symbol;
export type RenderFn<T> = (item: Signal<T>, index: Signal<number>, ctx: Context) => Renderable;

type ConnectedItem<T> = {
  key: any;
  item: Source<T>;
  index: Source<number>;
  node: MarkupNode;
};

// ----- Code ----- //

export class Repeat<T> implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  root = document.createTextNode("");

  private context;

  private items: Signal<T[]>;
  private key: KeyFn<T>;
  private render: RenderFn<T>;

  private unsubscribe: UnsubscribeFn | null = null;
  private connectedItems: ConnectedItem<T>[] = [];

  get isMounted() {
    return this.root.parentNode != null;
  }

  constructor(context: Context, items: Signal<T[]>, key: KeyFn<T>, render: RenderFn<T>) {
    this.context = context;

    this.items = items;
    this.key = key;
    this.render = render;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.root, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        let value = this.items();

        if (value == null) {
          value = [];
          this.context.warn("repeat() received empty value for items", value);
        }

        peek(() => {
          this._update(Array.from(value));
        });
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (!parentIsUnmounting && this.isMounted) {
      this.root.parentNode?.removeChild(this.root);
    }

    this._cleanup(parentIsUnmounting);
  }

  private _cleanup(parentIsUnmounting: boolean) {
    for (const item of this.connectedItems) {
      item.node.unmount(parentIsUnmounting);
    }
    this.connectedItems = [];
  }

  private _update(value: T[]) {
    if (value.length === 0 || !this.isMounted) {
      return this._cleanup(false);
    }

    type UpdateItem = { key: string | number | symbol; value: T; index: number };

    const potentialItems: UpdateItem[] = [];
    let index = 0;

    for (const item of value) {
      potentialItems.push({
        key: this.key(item, index),
        value: item,
        index: index++,
      });
    }

    const newItems: ConnectedItem<T>[] = [];

    // Remove views for items that no longer exist in the new list.
    for (const connected of this.connectedItems) {
      const potentialItem = potentialItems.find((p) => p.key === connected.key);

      if (!potentialItem) {
        connected.node.unmount(false);
      }
    }

    // Add new views and update state for existing ones.
    for (const potential of potentialItems) {
      const connected = this.connectedItems.find((item) => item.key === potential.key);

      if (connected) {
        connected.item(potential.value);
        connected.index(potential.index);
        newItems[potential.index] = connected;
      } else {
        // deepEqual avoids running update code again if the data is equivalent. In list updates this happens a lot.
        const item = $(potential.value, { equals: deepEqual });
        const index = $(potential.index);

        newItems[potential.index] = {
          key: potential.key,
          item,
          index,
          node: new ViewInstance(this.context, RepeatItemView, {
            item: () => item(),
            index: () => index(),
            renderFn: this.render,
          }),
        };
      }
    }

    // Reconnect to ensure order. Lifecycle hooks won't be run again if the view is already connected.
    // TODO: Use a smarter inline reordering method. This causes scrollbars to jump.
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const previous = newItems[i - 1]?.node.root ?? this.root;
      item.node.mount(this.root.parentNode!, previous);
    }

    this.connectedItems = newItems;

    // Move marker node to end.
    const lastItem = newItems.at(-1)?.node.root ?? this.root;
    this.root.parentNode?.insertBefore(this.root, lastItem.nextSibling);
  }
}

interface ListItemProps {
  item: Signal<any>;
  index: Signal<number>;
  renderFn: (item: Signal<any>, index: Signal<number>, context: Context) => Renderable;
}

function RepeatItemView(props: ListItemProps, context: Context) {
  context.setName("@RepeatItem");
  return props.renderFn.call(context, props.item, props.index, context);
}
