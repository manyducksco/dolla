import { isArray, typeOf } from "../../typeChecking.js";
import type { Renderable } from "../../types.js";
import type { Context } from "../context.js";
import { isMarkupElement, isRenderable, toMarkup, toMarkupElements, type MarkupElement } from "../markup.js";
import { effect, peek, Signal, type UnsubscribeFn } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";
import { ViewInstance, VIEW } from "./view.js";

interface DynamicOptions {
  source: Signal<Renderable>;
  context: Context;
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
  private context: Context;

  private source: Signal<Renderable>;
  private unsubscribe?: UnsubscribeFn;

  get isMounted() {
    return this.domNode.parentNode != null;
  }

  constructor(options: DynamicOptions) {
    this.source = options.source;
    this.context = options.context;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.domNode, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        try {
          const content = this.source();

          if (!isRenderable(content)) {
            console.error(content);
            throw new TypeError(
              `Dynamic received invalid value to render. Got type: ${typeOf(content)}, value: ${content}`,
            );
          }

          peek(() => {
            this.update(isArray(content) ? content : [content]);
          });
        } catch (error) {
          const logger = this.context.getState<ViewInstance<any>>(VIEW).context;
          logger.error(error);
          logger.crash(error as Error);
        }
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
        return toMarkupElements(this.context, toMarkup(c));
      }
    });

    // console.log("$dynamic update", newElements, children);

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
