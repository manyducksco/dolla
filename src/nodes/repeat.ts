import { type AppContext, type ElementContext } from "../app.js";
import { type DOMHandle } from "../markup.js";
import { signal, type Signal, type SignalSetter, type StopFunction } from "../signals.js";
import { deepEqual } from "../utils.js";
import { initView, type ViewContext, type ViewResult } from "../view.js";

// ----- Types ----- //

interface RepeatOptions<T> {
  appContext: AppContext;
  elementContext: ElementContext;
  $items: Signal<T[]>;
  keyFn: (value: T, index: number) => string | number | symbol;
  renderFn: ($value: Signal<T>, $index: Signal<number>, ctx: ViewContext) => ViewResult;
}

type ConnectedItem<T> = {
  key: any;
  $value: Signal<T>;
  setValue: SignalSetter<T>;
  $index: Signal<number>;
  setIndex: SignalSetter<number>;
  handle: DOMHandle;
};

// ----- Code ----- //

export class Repeat<T> implements DOMHandle {
  node: Node;
  endNode: Node;
  $items: Signal<T[]>;
  stopCallback?: StopFunction;
  connectedItems: ConnectedItem<T>[] = [];
  appContext;
  elementContext;
  renderFn: ($value: Signal<T>, $index: Signal<number>, ctx: ViewContext) => ViewResult;
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

      this.stopCallback = this.$items.watch((value) => {
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
        console.log("updating existing item", {
          current: connected.$value.get(),
          potential: potential.value,
          equal: deepEqual(connected.$value.get(), potential.value),
        });

        connected.setValue(potential.value);
        connected.setIndex(potential.index);
        newItems[potential.index] = connected;
      } else {
        const [$value, setValue] = signal<T>(potential.value);
        const [$index, setIndex] = signal(potential.index);

        newItems[potential.index] = {
          key: potential.key,
          $value,
          setValue,
          $index,
          setIndex,
          handle: initView({
            view: RepeatItemView,
            appContext: this.appContext,
            elementContext: this.elementContext,
            props: { $value, $index, renderFn: this.renderFn },
          }),
        };

        console.log("adding new item", newItems[potential.index]);
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
  $value: Signal<any>;
  $index: Signal<number>;
  renderFn: ($value: Signal<any>, $index: Signal<number>, ctx: ViewContext) => ViewResult;
}

function RepeatItemView({ $value, $index, renderFn }: RepeatItemProps, ctx: ViewContext) {
  return renderFn($value, $index, ctx);
}
