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
