import { type AppContext, type ElementContext } from "../app.js";
import { type DOMHandle } from "../markup.js";
import { observe, readable, writable, type Readable, type StopFunction, type Writable } from "../state.js";
import { initView, type ViewContext, type ViewResult } from "../view.js";

// ----- Types ----- //

interface RepeatOptions<T> {
  appContext: AppContext;
  elementContext: ElementContext;
  $items: Readable<T[]>;
  keyFn: (value: T, index: number) => string | number | symbol;
  renderFn: ($value: Readable<T>, $index: Readable<number>, ctx: ViewContext) => ViewResult;
}

type ConnectedItem<T> = {
  key: any;
  $$value: Writable<T>;
  $$index: Writable<number>;
  handle: DOMHandle;
};

// ----- Code ----- //

export class Repeat<T> implements DOMHandle {
  node: Node;
  endNode: Node;
  $items: Readable<T[]>;
  stopCallback?: StopFunction;
  connectedItems: ConnectedItem<T>[] = [];
  appContext;
  elementContext;
  renderFn: ($value: Readable<T>, $index: Readable<number>, ctx: ViewContext) => ViewResult;
  keyFn: (value: T, index: number) => string | number | symbol;

  get connected() {
    return this.node.parentNode != null;
  }

  constructor({ appContext, elementContext, $items, renderFn, keyFn }: RepeatOptions<T>) {
    this.appContext = appContext;
    this.elementContext = elementContext;

    this.$items = $items;
    this.renderFn = renderFn;
    this.keyFn = keyFn;

    if (appContext.mode === "development") {
      this.node = document.createComment("Repeat");
      this.endNode = document.createComment("/Repeat");
    } else {
      this.node = document.createTextNode("");
      this.endNode = document.createTextNode("");
    }
  }

  connect(parent: Node, after?: Node) {
    if (!this.connected) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.stopCallback = observe(this.$items, (value) => {
        this._update(Array.from(value));
      });
    }
  }

  disconnect() {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    if (this.connected) {
      this.node.parentNode?.removeChild(this.node);
      this.endNode.parentNode?.removeChild(this.endNode);
    }

    this._cleanup();
  }

  setChildren() {
    console.warn("setChildren is not implemented for repeat()");
  }

  _cleanup() {
    for (const item of this.connectedItems) {
      item.handle.disconnect();
    }
    this.connectedItems = [];
  }

  _update(value: T[]) {
    if (value.length === 0 || !this.connected) {
      return this._cleanup();
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
        connected.handle.disconnect();
      }
    }

    // Add new views and update state for existing ones.
    for (const potential of potentialItems) {
      const connected = this.connectedItems.find((item) => item.key === potential.key);

      if (connected) {
        connected.$$value.set(potential.value);
        connected.$$index.set(potential.index);
        newItems[potential.index] = connected;
      } else {
        const $$value = writable(potential.value) as Writable<T>;
        const $$index = writable(potential.index);

        newItems[potential.index] = {
          key: potential.key,
          $$value,
          $$index,
          handle: initView({
            view: RepeatItemView,
            appContext: this.appContext,
            elementContext: this.elementContext,
            props: { $value: readable($$value), $index: readable($$index), renderFn: this.renderFn },
          }),
        };
      }
    }

    // Reconnect to ensure order. Lifecycle hooks won't be run again if the view is already connected.
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const previous = newItems[i - 1]?.handle.node ?? this.node;
      item.handle.connect(this.node.parentNode!, previous);
    }

    this.connectedItems = newItems;

    if (this.appContext.mode === "development") {
      this.node.textContent = `Repeat (${newItems.length} item${newItems.length === 1 ? "" : "s"})`;

      const lastItem = newItems.at(-1)?.handle.node ?? this.node;
      this.node.parentNode?.insertBefore(this.endNode, lastItem.nextSibling);
    }
  }
}

interface RepeatItemProps {
  $value: Readable<any>;
  $index: Readable<number>;
  renderFn: ($value: Readable<any>, $index: Readable<number>, ctx: ViewContext) => ViewResult;
}

function RepeatItemView({ $value, $index, renderFn }: RepeatItemProps, ctx: ViewContext) {
  return renderFn($value, $index, ctx);
}
