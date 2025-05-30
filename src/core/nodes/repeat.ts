import { deepEqual } from "../../utils.js";
import { type ElementContext } from "../context.js";
import { type MarkupElement } from "../markup.js";
import { $, effect, peek, type Signal, type Source, type UnsubscribeFn } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";
import { View, type ViewContext, type ViewResult } from "./view.js";

// ----- Types ----- //

interface RepeatOptions<T> {
  elementContext: ElementContext;
  items: Signal<T[]>;
  keyFn: (item: T, index: number) => string | number | symbol;
  renderFn: (item: Signal<T>, index: Signal<number>, ctx: ViewContext) => ViewResult;
}

type ConnectedItem<T> = {
  key: any;
  item: Source<T>;
  index: Source<number>;
  element: MarkupElement;
};

// ----- Code ----- //

export class Repeat<T> implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode = document.createTextNode("");
  private items: Signal<T[]>;
  private unsubscribe: UnsubscribeFn | null = null;
  private connectedItems: ConnectedItem<T>[] = [];
  private elementContext;
  private renderFn: (this: ViewContext, value: Signal<T>, index: Signal<number>, context: ViewContext) => ViewResult;
  private keyFn: (value: T, index: number) => string | number | symbol;

  get isMounted() {
    return this.domNode.parentNode != null;
  }

  constructor({ elementContext, items, renderFn, keyFn }: RepeatOptions<T>) {
    this.elementContext = elementContext;

    this.items = items;
    this.renderFn = renderFn;
    this.keyFn = keyFn;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.domNode, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        let value = this.items();

        if (value == null) {
          value = [];
          console.log("repeat received empty value", value, this);
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
      this.domNode.parentNode?.removeChild(this.domNode);
    }

    this._cleanup(parentIsUnmounting);
  }

  private _cleanup(parentIsUnmounting: boolean) {
    for (const item of this.connectedItems) {
      item.element.unmount(parentIsUnmounting);
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
        key: this.keyFn(item, index),
        value: item,
        index: index++,
      });
    }

    const newItems: ConnectedItem<T>[] = [];

    // Remove views for items that no longer exist in the new list.
    for (const connected of this.connectedItems) {
      const potentialItem = potentialItems.find((p) => p.key === connected.key);

      if (!potentialItem) {
        connected.element.unmount(false);
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
          element: new View(this.elementContext, RepeatItemView, {
            item: () => item(),
            index: () => index(),
            renderFn: this.renderFn,
          }),
        };
      }
    }

    // Reconnect to ensure order. Lifecycle hooks won't be run again if the view is already connected.
    // TODO: Use a smarter inline reordering method. This causes scrollbars to jump.
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const previous = newItems[i - 1]?.element.domNode ?? this.domNode;
      item.element.mount(this.domNode.parentNode!, previous);
    }

    this.connectedItems = newItems;

    // Move marker node to end.
    const lastItem = newItems.at(-1)?.element.domNode ?? this.domNode;
    this.domNode.parentNode?.insertBefore(this.domNode, lastItem.nextSibling);
  }
}

interface ListItemProps {
  item: Signal<any>;
  index: Signal<number>;
  renderFn: (item: Signal<any>, index: Signal<number>, context: ViewContext) => ViewResult;
}

function RepeatItemView(props: ListItemProps, context: ViewContext) {
  context.name = "@RepeatItem";
  return props.renderFn.call(context, props.item, props.index, context);
}
