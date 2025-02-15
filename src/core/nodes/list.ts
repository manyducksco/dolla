import { type ElementContext } from "../context.js";
import { type MarkupElement } from "../markup.js";
import { type Atom, atom, compose, type Reactive, type UnsubscribeFunction } from "../reactive.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";
import { View, type ViewContext, type ViewResult } from "./view.js";

// ----- Types ----- //

interface ListOptions<T> {
  elementContext: ElementContext;
  items: Reactive<T[]>;
  keyFn: (item: T, index: number) => string | number | symbol;
  renderFn: (item: Reactive<T>, index: Reactive<number>, ctx: ViewContext) => ViewResult;
}

type ConnectedItem<T> = {
  key: any;
  item: Atom<T>;
  index: Atom<number>;
  element: MarkupElement;
};

// ----- Code ----- //

export class List<T> implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  node = document.createTextNode("");
  items: Reactive<T[]>;
  unsubscribe: UnsubscribeFunction | null = null;
  connectedItems: ConnectedItem<T>[] = [];
  elementContext;
  renderFn: (this: ViewContext, value: Reactive<T>, index: Reactive<number>, context: ViewContext) => ViewResult;
  keyFn: (value: T, index: number) => string | number | symbol;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ elementContext, items, renderFn, keyFn }: ListOptions<T>) {
    this.elementContext = elementContext;

    this.items = items;
    this.renderFn = renderFn;
    this.keyFn = keyFn;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.unsubscribe = this.items.subscribe((value) => {
        if (!this.isMounted) {
          this._update(Array.from(value));
        } else {
          this.elementContext.root.batch.write(() => {
            this._update(Array.from(value));
          });
        }
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (!parentIsUnmounting && this.isMounted) {
      this.node.parentNode?.removeChild(this.node);
    }

    this._cleanup(parentIsUnmounting);
  }

  _cleanup(parentIsUnmounting: boolean) {
    for (const item of this.connectedItems) {
      item.element.unmount(parentIsUnmounting);
    }
    this.connectedItems = [];
  }

  _update(value: T[]) {
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
        connected.item.value = potential.value;
        connected.index.value = potential.index;
        newItems[potential.index] = connected;
      } else {
        const item = atom(potential.value);
        const index = atom(potential.index);

        newItems[potential.index] = {
          key: potential.key,
          item,
          index,
          element: new View(this.elementContext, ListItemView, {
            item: compose((get) => get(item)),
            index,
            renderFn: this.renderFn,
          }),
        };
      }
    }

    // Reconnect to ensure order. Lifecycle hooks won't be run again if the view is already connected.
    // TODO: Use a smarter inline reordering method. This causes scrollbars to jump.
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const previous = newItems[i - 1]?.element.node ?? this.node;
      item.element.mount(this.node.parentNode!, previous);
    }

    this.connectedItems = newItems;

    // Move marker node to end.
    const lastItem = newItems.at(-1)?.element.node ?? this.node;
    this.node.parentNode?.insertBefore(this.node, lastItem.nextSibling);
  }
}

interface ListItemProps {
  item: Reactive<any>;
  index: Reactive<number>;
  renderFn: (item: Reactive<any>, index: Reactive<number>, context: ViewContext) => ViewResult;
}

function ListItemView(props: ListItemProps, context: ViewContext) {
  context.setName("@ListItem");
  return props.renderFn.call(context, props.item, props.index, context);
}
