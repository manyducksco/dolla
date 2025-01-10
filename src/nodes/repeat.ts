import { type DOMHandle, type ElementContext } from "../markup.js";
import { isDevEnvironment } from "../modules/core.js";
import { createSignal, type Signal, type SignalSetter, type StopFunction } from "../signals.js";
import { initView, type ViewContext, type ViewResult } from "../view.js";

// ----- Types ----- //

interface RepeatOptions<T> {
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
  elementContext;
  renderFn: ($value: Signal<T>, $index: Signal<number>, ctx: ViewContext) => ViewResult;
  keyFn: (value: T, index: number) => string | number | symbol;

  get connected() {
    return this.node.parentNode != null;
  }

  constructor({ elementContext, $items, renderFn, keyFn }: RepeatOptions<T>) {
    this.elementContext = elementContext;

    this.$items = $items;
    this.renderFn = renderFn;
    this.keyFn = keyFn;

    if (isDevEnvironment()) {
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
        connected.setValue(potential.value);
        connected.setIndex(potential.index);
        newItems[potential.index] = connected;
      } else {
        const [$value, setValue] = createSignal<T>(potential.value);
        const [$index, setIndex] = createSignal(potential.index);

        newItems[potential.index] = {
          key: potential.key,
          $value,
          setValue,
          $index,
          setIndex,
          handle: initView({
            view: RepeatItemView,
            elementContext: this.elementContext,
            props: { $value, $index, renderFn: this.renderFn },
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

    if (isDevEnvironment()) {
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
