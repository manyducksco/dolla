import { isArray, typeOf } from "../../typeChecking.js";
import type { Renderable } from "../../types.js";
import type { ElementContext } from "../context.js";
import { constructMarkup, isMarkupElement, isRenderable, toMarkup, type MarkupElement } from "../markup.js";
import { effect, untrack, type Reactive, type UnsubscribeFunction } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

interface DynamicOptions {
  source: Reactive<Renderable>;
  elementContext: ElementContext;
}

/**
 * Displays dynamic children without a parent element.
 * Renders a Reactive value via a render function.
 *
 * This is probably the most used element type aside from HTML.
 */
export class Dynamic implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode = document.createTextNode("");
  private children: MarkupElement[] = [];
  private elementContext: ElementContext;

  private source: Reactive<Renderable>;
  private unsubscribe?: UnsubscribeFunction;

  get isMounted() {
    return this.domNode.parentNode != null;
  }

  constructor(options: DynamicOptions) {
    this.source = options.source;
    this.elementContext = options.elementContext;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.domNode, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        const content = this.source.get();

        if (!isRenderable(content)) {
          console.error(content);
          throw new TypeError(
            `Dynamic received invalid value to render. Got type: ${typeOf(content)}, value: ${content}`,
          );
        }

        untrack(() => {
          this.update(isArray(content) ? content : [content]);
        });
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    this.unsubscribe?.();

    if (this.isMounted) {
      this.cleanup(parentIsUnmounting);
      this.domNode.parentNode?.removeChild(this.domNode);
    }
  }

  cleanup(parentIsUnmounting: boolean) {
    for (const element of this.children) {
      element.unmount(parentIsUnmounting);
    }
    this.children = [];
  }

  update(children: Renderable[]) {
    this.cleanup(false);

    if (children == null || children.length === 0 || !this.isMounted) {
      return;
    }

    const newElements: MarkupElement[] = children.flatMap((c) => {
      if (isMarkupElement(c)) {
        return c as MarkupElement;
      } else {
        return constructMarkup(this.elementContext, toMarkup(c));
      }
    });

    for (const element of newElements) {
      const previous = this.children.at(-1)?.domNode || this.domNode;
      element.mount(this.domNode.parentNode!, previous);
      this.children.push(element);
    }

    // Move marker node to end.
    const parent = this.domNode.parentNode!;
    const lastChildNextSibling = this.children.at(-1)?.domNode?.nextSibling ?? null;
    if ("moveBefore" in parent) {
      (parent.moveBefore as any)(this.domNode, lastChildNextSibling);
    } else {
      parent.insertBefore(this.domNode, lastChildNextSibling);
    }
  }
}
