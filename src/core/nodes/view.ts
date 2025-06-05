import { isArrayOf, isFunction, typeOf } from "../../typeChecking.js";
import { getUniqueId } from "../../utils.js";
import { Context } from "../context.js";
import { isMarkup, m, render, type Markup, type MarkupElement } from "../markup.js";
import { $, type Signal } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

export const ROUTE = Symbol("View.route");
export const VIEW = Symbol("View");

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | Signal<any> | Markup | Markup[] | null;

/**
 *
 */
export type View<P> = (this: Context, props: P, context: Context) => ViewResult;

/**
 * A view that has been constructed into DOM nodes.
 */
// export interface ViewElement extends MarkupElement {
//   setRouteView(view: ViewFn<{}>): ViewElement;
// }

export class ViewInstance<P> implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  uniqueId = getUniqueId();
  context: Context;
  props;
  fn;

  element?: MarkupElement;

  $name = $("");

  constructor(context: Context, fn: View<P>, props: P, children?: Markup[]) {
    this.$name(fn.name || "🌇 anonymous view");
    this.context = Context.inherit(context, this.$name, {
      logger: {
        tag: this.uniqueId,
        tagName: "uid",
      },
    });
    this.context.setState(VIEW, this);
    this.props = {
      ...props,
      children,
    };
    this.fn = fn;
  }

  /*===============================*\
  ||         "Public" API          ||
  \*===============================*/

  get domNode() {
    return this.element?.domNode!;
  }

  isMounted = false;

  mount(parent: Node, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasConnected = this.isMounted;

    if (!wasConnected) {
      this._initialize();
      this.context._lifecycle.willMount();
    }

    if (this.element) {
      this.element.mount(parent, after);
    }

    if (!wasConnected) {
      this.isMounted = true;

      requestAnimationFrame(() => {
        this.context._lifecycle.didMount();
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    this.context._lifecycle.willUnmount();

    if (this.element) {
      // parentIsUnmounting is forwarded to the element because the view acts as a proxy for an element.
      this.element.unmount(parentIsUnmounting);
    }

    this.isMounted = false;

    this.context._lifecycle.didUnmount();
  }

  // setRouteView(fn: View<{}>) {
  //   const node = new ViewInstance(this.context, fn, {});

  //   const $route = this.context.getState(ROUTE) as Source<ViewInstance<{}>>;
  //   $route(node);

  //   return node;
  // }

  /*===============================*\
  ||           Internal            ||
  \*===============================*/

  private _initialize() {
    const { context } = this;

    let result: ViewResult;
    try {
      result = this.fn.call(context, this.props, context);
    } catch (error) {
      if (error instanceof Error) {
        this.context.crash(error);
      }
      throw error;
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      this.element = render(m("$node", { value: result }), this.context);
    } else if (isFunction(result)) {
      this.element = render(m("$dynamic", { source: result }), this.context);
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      this.element = render(result, this.context);
    } else {
      const error = new TypeError(
        `Expected '${
          this.fn.name
        }' function to return a DOM node, Markup element, Signal or null. Got: ${typeOf(result)}`,
      );
      this.context.crash(error);
    }
  }
}
