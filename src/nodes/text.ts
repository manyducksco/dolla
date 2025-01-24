import { type MarkupElement } from "../markup.js";
import { isState, type MaybeState, type StopFunction } from "../state.js";

interface Stringable {
  toString(): string;
}

interface TextOptions {
  value: MaybeState<Stringable>;
}

export class Text implements MarkupElement {
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

  async unmount() {
    if (this.isMounted) {
      if (this.stopCallback) {
        this.stopCallback();
        this.stopCallback = undefined;
      }

      this.node.parentNode!.removeChild(this.node);
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
