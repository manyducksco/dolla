import { constructMarkup, toMarkup, type MarkupElement, type ElementContext, type Markup } from "../markup.js";
import { type State, type StopFunction } from "../state.js";
import { type Renderable } from "../types.js";

export interface ConditionalConfig {
  $predicate: State<any>;
  thenContent?: Renderable;
  elseContent?: Renderable;
  elementContext: ElementContext;
}

export class Conditional implements MarkupElement {
  node: Node;
  endNode: Node;
  $predicate: State<any>;
  stopCallback?: StopFunction;
  thenContent?: Markup[];
  elseContent?: Markup[];
  connectedContent: MarkupElement[] = [];
  elementContext: ElementContext;

  initialUpdateHappened = false;
  previousValue?: any;

  constructor(config: ConditionalConfig) {
    this.$predicate = config.$predicate;
    this.thenContent = config.thenContent ? toMarkup(config.thenContent) : undefined;
    this.elseContent = config.elseContent ? toMarkup(config.elseContent) : undefined;
    this.elementContext = config.elementContext;

    if (this.elementContext.root.getEnv() === "development") {
      this.node = document.createComment("Conditional");
      this.endNode = document.createComment("/Conditional");
    } else {
      this.node = document.createTextNode("");
      this.endNode = document.createTextNode("");
    }
  }

  get isMounted() {
    return this.node.parentNode != null;
  }

  mount(parent: Node, after?: Node | undefined): void {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);
      if (this.elementContext.root.getEnv() === "development") {
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

  unmount(): void {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    for (const handle of this.connectedContent) {
      handle.unmount();
    }
    this.connectedContent = [];

    if (this.isMounted) {
      this.node.parentNode?.removeChild(this.node);
      this.endNode.parentNode?.removeChild(this.endNode);
    }
  }

  update(value: any) {
    for (const handle of this.connectedContent) {
      handle.unmount();
    }
    this.connectedContent = [];

    if (this.node.parentNode == null) {
      return;
    }

    if (value && this.thenContent) {
      this.connectedContent = constructMarkup(this.elementContext, this.thenContent);
    } else if (!value && this.elseContent) {
      this.connectedContent = constructMarkup(this.elementContext, this.elseContent);
    }

    for (let i = 0; i < this.connectedContent.length; i++) {
      const handle = this.connectedContent[i];
      const previous = this.connectedContent[i - 1]?.node ?? this.node;
      handle.mount(this.node.parentNode, previous);
    }

    if (this.elementContext.root.getEnv() === "development") {
      this.node.textContent = `Conditional (${value ? "truthy" : "falsy"})`;
    }
  }
}
