import { type MarkupElement } from "../markup.js";
import { isState, type MaybeState, type StopFunction } from "../state.js";
import { TYPE_MARKUP_ELEMENT } from "../symbols.js";

interface Stringable {
  toString(): string;
}

interface TextOptions {
  value: MaybeState<Stringable>;
}

export class Text implements MarkupElement {
  [TYPE_MARKUP_ELEMENT] = true;

  node = document.createTextNode("");
  value: MaybeState<Stringable> = "";
  stopCallback?: StopFunction;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ value }: TextOptions) {
    this.value = value;
  }

  async mount(parent: Node, after: Node | null = null) {
    if (!this.isMounted) {
      if (isState<Stringable>(this.value)) {
        this.stopCallback = this.value.watch((value) => {
          this.update(value);
        });
      } else {
        this.update(this.value);
      }
    }

    parent.insertBefore(this.node, after?.nextSibling ?? null);
  }

  async unmount(parentIsUnmounting = false) {
    if (this.isMounted) {
      if (this.stopCallback) {
        this.stopCallback();
        this.stopCallback = undefined;
      }

      if (!parentIsUnmounting) {
        this.node.parentNode!.removeChild(this.node);
      }
    }
  }

  update(value?: Stringable) {
    if (value != null) {
      this.node.textContent = value.toString();
    } else {
      this.node.textContent = "";
    }
  }
}
