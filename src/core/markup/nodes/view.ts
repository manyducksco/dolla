import type { Renderable, View } from "../../../types.js";
import { assert } from "../../../utils.js";
import { ComponentState, Context, createContext, mountContext, unmountContext } from "../../context.js";
import { peek } from "../../signals.js";
import { MarkupNode } from "../types.js";
import { createTextNode, render } from "../utils.js";
import { DOMNode } from "./dom.js";

export const VIEW = Symbol.for("$_VIEW_NODE");

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly #props: P;
  readonly #view: View<P>;
  #node?: MarkupNode;

  readonly context: Context<ComponentState & Record<string | symbol, any>>;

  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = createContext(context) as Context<ComponentState>;
    this.context[VIEW] = this;
    this.context.name = view.name;
    this.#props = props;
    this.#view = view;
  }

  getRoot() {
    return this.#node?.getRoot();
  }

  isMounted() {
    return this.context.isMounted;
  }

  mount(parent: Element, after?: Node) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      const viewContent = peek(() => this.#view.call(this.context, this.#props, this.context));

      if (viewContent != null && viewContent !== false) {
        this.#node = render(viewContent, this.context);
      } else {
        this.#node = new DOMNode(this.context, createTextNode(""));
      }
    }

    this.#node!.mount(parent, after);

    if (!wasMounted) mountContext(this.context);
  }

  unmount(skipDOM = false) {
    this.#node?.unmount(skipDOM);
    unmountContext(this.context);
  }

  move(parent: Element, after?: Node) {
    this.#node?.move(parent, after);
  }
}

type GenericProps = {
  [prop: string]: any;
};

export function createView<Props = GenericProps>(
  name: string,
  callback: (context: Context, props: Props) => Renderable,
): View<Props>;

export function createView<Props = GenericProps>(callback: (context: Context, props: Props) => Renderable): View<Props>;

export function createView<Props = GenericProps>(...args: any[]): View<Props> {
  let name: string | undefined;
  let callback: (context: Context, props: Props) => Renderable;

  if (args.length === 2) {
    assert(typeof args[0] === "string", "When 2 args, the first must be a string");
    assert(typeof args[1] === "function", "When 2 args, the second must be a function");

    name = args[0];
    callback = args[1];
  } else if (args.length === 1) {
    assert(typeof args[0] === "function", "When 1 arg, the value must be a function");

    callback = args[0];
  }

  return function (props) {
    if (name) {
      this.name = name;
    }
    return callback(this, props);
  };
}
