import type { Renderable } from "../../../types.js";
import { Context } from "../../context.js";
import { MarkupNode, MountTarget } from "../types.js";
import { addChild, createTextNode, moveAfter, render } from "../utils.js";

/**
 * Renders content into a specified parent node.
 */
export class PortalNode extends MarkupNode {
  // Acts as a physical placeholder in the logical DOM tree
  #anchor = createTextNode("");

  #context: Context;
  #value: Renderable;
  #parent: MountTarget;
  #childNode?: MarkupNode;

  constructor(context: Context, value: Renderable, parent: MountTarget) {
    super();
    this.#context = context;
    this.#value = value;
    this.#parent = parent;
  }

  override getRoot() {
    // Return the anchor, allowing siblings to mount correctly around it
    return this.#anchor;
  }

  override isMounted() {
    return this.#anchor.parentNode != null;
  }

  override mount(logicalParent: MountTarget, after?: Node) {
    if (!this.isMounted()) {
      // Mount the anchor in the standard document flow
      addChild(logicalParent, this.#anchor, after);

      // Render the content and mount it to the portal target
      if (!this.#childNode) {
        this.#childNode = render(this.#value, this.#context);
      }
      this.#childNode.mount(this.#parent);
    }
  }

  override unmount(skipDOM = false) {
    if (this.isMounted()) {
      if (!skipDOM) {
        this.#anchor.parentNode?.removeChild(this.#anchor);
      }

      // Portals always force unmount the DOM of their children
      if (this.#childNode?.isMounted()) {
        this.#childNode.unmount(false);
      }
    }
  }

  override move(logicalParent: MountTarget, after?: Node) {
    moveAfter(logicalParent, this.#anchor, after);
  }
}
