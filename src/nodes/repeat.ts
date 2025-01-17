import { type MarkupNode, type ElementContext } from "../markup.js";
import { createState, type State, type Setter, type StopFunction } from "../state.js";
import { constructView, type ViewContext, type ViewResult } from "../view.js";

// ----- Types ----- //

interface RepeatOptions<T> {
  elementContext: ElementContext;
  $items: State<T[]>;
  keyFn: (value: T, index: number) => string | number | symbol;
  renderFn: ($value: State<T>, $index: State<number>, ctx: ViewContext) => ViewResult;
}

type ConnectedItem<T> = {
  key: any;
  $value: State<T>;
  setValue: Setter<T>;
  $index: State<number>;
  setIndex: Setter<number>;
  handle: MarkupNode;
};

// ----- Code ----- //

export class Repeat<T> implements MarkupNode {
  node: Node;
  endNode: Node;
  $items: State<T[]>;
  stopCallback?: StopFunction;
  connectedItems: ConnectedItem<T>[] = [];
  elementContext;
  renderFn: ($value: State<T>, $index: State<number>, ctx: ViewContext) => ViewResult;
  keyFn: (value: T, index: number) => string | number | symbol;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ elementContext, $items, renderFn, keyFn }: RepeatOptions<T>) {
    this.elementContext = elementContext;

    this.$items = $items;
    this.renderFn = renderFn;
    this.keyFn = keyFn;

    if (this.elementContext.root.getEnv() === "development") {
      this.node = document.createComment("Repeat");
      this.endNode = document.createComment("/Repeat");
    } else {
      this.node = document.createTextNode("");
      this.endNode = document.createTextNode("");
    }
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.stopCallback = this.$items.watch((value) => {
        this._update(Array.from(value));
      });
    }
  }

  unmount() {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    if (this.isMounted) {
      this.node.parentNode?.removeChild(this.node);
      this.endNode.parentNode?.removeChild(this.endNode);
    }

    this._cleanup();
  }

  _cleanup() {
    for (const item of this.connectedItems) {
      item.handle.unmount();
    }
    this.connectedItems = [];
  }

  _update(value: T[]) {
    if (value.length === 0 || !this.isMounted) {
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
        connected.handle.unmount();
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
        const [$value, setValue] = createState<T>(potential.value);
        const [$index, setIndex] = createState(potential.index);

        newItems[potential.index] = {
          key: potential.key,
          $value,
          setValue,
          $index,
          setIndex,
          handle: constructView(this.elementContext, RepeatItemView, {
            $value,
            $index,
            renderFn: this.renderFn,
          }),
        };
      }
    }

    // Reconnect to ensure order. Lifecycle hooks won't be run again if the view is already connected.
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const previous = newItems[i - 1]?.handle.node ?? this.node;
      item.handle.mount(this.node.parentNode!, previous);
    }

    this.connectedItems = newItems;

    if (this.elementContext.root.getEnv() === "development") {
      this.node.textContent = `Repeat (${newItems.length} item${newItems.length === 1 ? "" : "s"})`;

      const lastItem = newItems.at(-1)?.handle.node ?? this.node;
      this.node.parentNode?.insertBefore(this.endNode, lastItem.nextSibling);
    }
  }
}

interface RepeatItemProps {
  $value: State<any>;
  $index: State<number>;
  renderFn: ($value: State<any>, $index: State<number>, ctx: ViewContext) => ViewResult;
}

function RepeatItemView({ $value, $index, renderFn }: RepeatItemProps, ctx: ViewContext) {
  return renderFn($value, $index, ctx);
}
