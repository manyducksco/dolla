import type { IntrinsicElements, View } from "../../types.js";
import { Context } from "../index.js";

/**
 * Determines the type of the `props` object for any kind of Markup type.
 */
export type PropsOf<T extends string | View<any> | (new (...args: any[]) => MarkupNode)> =
  T extends View<infer P>
    ? P
    : T extends new (...args: infer Args) => MarkupNode
      ? { args: Args extends [Context, ...infer Rest] ? Rest : [] }
      : T extends keyof IntrinsicElements
        ? IntrinsicElements[T]
        : any;

export const IS_MARKUP = Symbol.for("Dolla.Markup");
export const IS_MARKUP_NODE = Symbol.for("Dolla.MarkupNode");

/**
 * A set of basic metadata that can be constructed into a `MarkupNode`.
 */
export interface Markup<
  Type extends string | View<any> | (new (...args: any[]) => MarkupNode) =
    | string
    | View<any>
    | (new (...args: any[]) => MarkupNode),
> {
  [IS_MARKUP]: true;
  type: Type;
  props: PropsOf<Type>;
}

export interface MountTarget {
  insertBefore(node: Node, child: Node | null): any;
}

/**
 * A node that can be mounted by the Markup layout engine. Can be extended to create new custom node types.
 *
 * A `MarkupNode` instance can be passed anywhere a `Renderable` is required.
 */
export abstract class MarkupNode {
  static readonly isMarkupNode = true;

  get [IS_MARKUP_NODE]() {
    return true;
  }

  /**
   * Returns a single DOM node to represent this MarkupNode's position in the DOM.
   * Usually the parent element, but it can be an empty Text node used as a marker.
   *
   * It only needs to be defined while the node is mounted, so it can be created in the `mount` function.
   */
  abstract getRoot(): Node | undefined;

  /**
   * Returns true while this node is mounted.
   */
  abstract isMounted(): boolean;

  /**
   * Mount this node to a `parent` element.
   * If passed, this node will be mounted as the next sibling of `after`.
   */
  abstract mount(parent: MountTarget, after?: Node): void;

  /**
   * Unmount this MarkupNode from its parent element.
   *
   * The `skipDOM` option can be passed as an optimization when unmounting a parent node.
   * A value of `true` indicates that no DOM operations need to happen because the parent is already being unmounted.
   *
   * @param skipDOM - No DOM updates will be performed when true. Lifecycle methods will be called regardless.
   */
  abstract unmount(skipDOM?: boolean): void;

  /**
   * Moves a node without unmounting and remounting (if the browser supports Element.moveBefore).
   */
  abstract move(parent: MountTarget, after?: Node): void;
}
