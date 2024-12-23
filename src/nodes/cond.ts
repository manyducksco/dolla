import { type AppContext, type ElementContext } from "../app.js";
import { renderMarkupToDOM, toMarkup, type DOMHandle, type Markup } from "../markup.js";
import { watch, type Signal, type StopFunction } from "../signals.js";
import { type Renderable } from "../types.js";

export interface ConditionalConfig {
  $predicate: Signal<any>;
  thenContent?: Renderable;
  elseContent?: Renderable;
  appContext: AppContext;
  elementContext: ElementContext;
}

export class Conditional implements DOMHandle {
  node: Node;
  endNode: Node;
  $predicate: Signal<any>;
  stopCallback?: StopFunction;
  thenContent?: Markup[];
  elseContent?: Markup[];
  connectedContent: DOMHandle[] = [];
  appContext: AppContext;
  elementContext: ElementContext;

  initialUpdateHappened = false;
  previousValue?: any;

  constructor(config: ConditionalConfig) {
    this.$predicate = config.$predicate;
    this.thenContent = config.thenContent ? toMarkup(config.thenContent) : undefined;
    this.elseContent = config.elseContent ? toMarkup(config.elseContent) : undefined;
    this.appContext = config.appContext;
    this.elementContext = config.elementContext;

    if (this.appContext.mode === "development") {
      this.node = document.createComment("Conditional");
      this.endNode = document.createComment("/Conditional");
    } else {
      this.node = document.createTextNode("");
      this.endNode = document.createTextNode("");
    }
  }

  get connected() {
    return this.node.parentNode != null;
  }

  connect(parent: Node, after?: Node | undefined): void {
    if (!this.connected) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);
      if (this.appContext.mode === "development") {
        parent.insertBefore(this.endNode, this.node.nextSibling);
      }

      this.stopCallback = this.$predicate.watch((value) => {
        // Only update if value changed between truthy and falsy.
        if (!this.initialUpdateHappened || (value && !this.previousValue) || (!value && this.previousValue)) {
          this.update(value);
          this.initialUpdateHappened = true;
          this.previousValue = value;
        }
      });
    }
  }

  disconnect(): void {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    for (const handle of this.connectedContent) {
      handle.disconnect();
    }
    this.connectedContent = [];

    if (this.connected) {
      this.node.parentNode?.removeChild(this.node);
      this.endNode.parentNode?.removeChild(this.endNode);
    }
  }

  update(value: any) {
    for (const handle of this.connectedContent) {
      handle.disconnect();
    }
    this.connectedContent = [];

    if (this.node.parentNode == null) {
      return;
    }

    if (value && this.thenContent) {
      this.connectedContent = renderMarkupToDOM(this.thenContent, this);
    } else if (!value && this.elseContent) {
      this.connectedContent = renderMarkupToDOM(this.elseContent, this);
    }

    for (let i = 0; i < this.connectedContent.length; i++) {
      const handle = this.connectedContent[i];
      const previous = this.connectedContent[i - 1]?.node ?? this.node;
      handle.connect(this.node.parentNode, previous);
    }

    if (this.appContext.mode === "development") {
      this.node.textContent = `Conditional (${value ? "truthy" : "falsy"})`;
    }
  }

  async setChildren(children: DOMHandle[]): Promise<void> {}
}
