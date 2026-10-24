import type { Renderable } from "../../../types.js";
import { Context } from "../../context.js";
import { VISIBILITY_SCOPE, VisibilityScope } from "../../visibility.js";
import { MarkupNode, MountTarget } from "../types.js";
import { addChild, createTextNode, moveAfter, render } from "../utils.js";

/**
 * Renders content into a specified parent node.
 */
export class PortalNode extends MarkupNode {
  // Acts as a physical placeholder in the logical DOM tree
  #anchor: Text | null = null;

  #context: Context;
  #value: Renderable;
  #parent: MountTarget;
  #childNode?: MarkupNode;

  #scope?: VisibilityScope;
  #detachedFragment: DocumentFragment | null = null;
  #hidden = false;

  constructor(context: Context, value: Renderable, parent: MountTarget) {
    super();
    this.#context = context;
    this.#value = value;
    this.#parent = parent;
  }

  override getRoot() {
    return this.#anchor ?? undefined;
  }

  override isMounted() {
    return this.#anchor?.parentNode != null;
  }

  override mount(logicalParent: MountTarget, after?: Node) {
    if (!this.isMounted()) {
      // Mount the anchor in the standard document flow
      this.#anchor = createTextNode("");
      addChild(logicalParent, this.#anchor, after);

      this.#scope = (this.#context as any)[VISIBILITY_SCOPE] as VisibilityScope | undefined;

      // Render the content and mount it to the portal target. If the nearest
      // keep-alive scope is already hidden, mount directly into the detached
      // fragment so the content never flashes in the target.
      if (!this.#childNode) {
        this.#childNode = render(this.#value, this.#context);
      }

      if (this.#scope?.hidden) {
        this.#hidden = true;
        this.#childNode.mount(this.#getDetachedFragment());
      } else {
        this.#childNode.mount(this.#parent);
      }

      this.#scope?.addResource(this);
    }
  }

  override unmount(skipDOM = false) {
    this.#scope?.deleteResource(this);
    this.#scope = undefined;

    if (this.isMounted()) {
      if (!skipDOM) {
        this.#anchor!.parentNode?.removeChild(this.#anchor!);
      }

      // Portals always force unmount the DOM of their children
      if (this.#childNode?.isMounted()) {
        this.#childNode.unmount(false);
      }
    }

    this.#hidden = false;
    this.#detachedFragment = null;
  }

  /**
   * Called by the nearest keep-alive scope. Moves portal content out of its
   * target without unmounting it.
   */
  hide() {
    if (this.#hidden || !this.#childNode) return;
    this.#hidden = true;
    this.#childNode.move(this.#getDetachedFragment());
  }

  /**
   * Called by the nearest keep-alive scope. Restores portal content to its
   * target.
   */
  show() {
    if (!this.#hidden || !this.#childNode) return;
    this.#hidden = false;
    this.#childNode.move(this.#parent);
  }

  #getDetachedFragment() {
    return (this.#detachedFragment ??= document.createDocumentFragment());
  }

  override move(logicalParent: MountTarget, after?: Node) {
    if (!this.#anchor) return;
    moveAfter(logicalParent, this.#anchor, after);
  }
}
