import type { IntrinsicElements, Renderable, View } from "../../types.js";
import { IdGenerator } from "../../utils.js";
import type { Reactive } from "../reactive.js";
import { KeyFn, RenderFn } from "./nodes/repeat.js";

export enum NodeType {
  DOM,
  Dynamic,
  Element,
  Portal,
  Repeat,
  View,
}

// TODO: Better typing for these props?

export interface MarkupNodeProps {
  [NodeType.DOM]: {
    node: Node;
  };
  [NodeType.Dynamic]: {
    slot: Reactive<any>;
  };
  [NodeType.Element]: {
    tag: string;
    props: Record<string, any>;
  };
  [NodeType.Portal]: {
    parent: Element;
    content: Renderable;
  };
  [NodeType.Repeat]: {
    items: Reactive<Iterable<any>>;
    key: KeyFn<any>;
    render: RenderFn<Renderable>;
  };
  [NodeType.View]: {
    view: View<any>;
    props: any;
  };
}

/**
 * Determines the type of the `props` object for any kind of Markup type.
 */
type PropsOf<T extends string | NodeType | View<any>> =
  T extends View<infer P>
    ? P
    : T extends NodeType
      ? MarkupNodeProps[T]
      : T extends keyof IntrinsicElements
        ? IntrinsicElements[T]
        : any;

/**
 * A is a set of basic metadata that can be constructed into a `MarkupNode`.
 */
export class Markup<Type extends string | NodeType | View<any> = string | NodeType | View<any>> {
  type;
  props;

  constructor(type: Type, props: PropsOf<Type>) {
    this.type = type;
    this.props = props;
  }
}

/**
 * A node that can be mounted by the Markup layout engine. Can be extended to create new custom node types.
 *
 * A `MarkupNode` instance can be passed anywhere a `Renderable` is required.
 */
export abstract class MarkupNode {
  /**
   * Returns a single DOM node to represent this MarkupNode's position in the DOM.
   * Usually the parent element, but it can be an empty Text node used as a marker.
   *
   * It only needs to be defined while the node is mounted, so it can be created in the `mount` function.
   */
  getRoot(): Node | undefined {
    throw new Error("getRoot method is not implemented");
  }

  /**
   * Returns true while this node is mounted.
   */
  isMounted(): boolean {
    throw new Error("isMounted method is not implemented");
  }

  /**
   * Mount this node to a `parent` element.
   * If passed, this node will be mounted as the next sibling of `after`.
   */
  mount(parent: Element, after?: Node): void {
    throw new Error("mount method is not implemented");
  }

  /**
   * Unmount this MarkupNode from its parent element.
   *
   * The `skipDOM` option can be passed as an optimization when unmounting a parent node.
   * A value of `true` indicates that no DOM operations need to happen because the parent is already being unmounted.
   *
   * @param skipDOM - No DOM updates will be performed when true. Lifecycle methods will be called regardless.
   */
  unmount(skipDOM?: boolean): void {
    throw new Error("unmount method is not implemented");
  }

  /**
   * Moves a node without unmounting and remounting (if the browser supports Element.moveBefore).
   */
  move(parent: Element, after?: Node): void {
    throw new Error("move method is not implemented");
  }
}
