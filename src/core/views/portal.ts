import { isString } from "../../typeChecking";
import type { Renderable } from "../../types";
import { $$context, $debug } from "../hooks";
import { PortalNode } from "../nodes/portal";

export interface PortalProps {
  /**
   * The parent element or a selector that will match it.
   */
  into: Element | string;

  /**
   * Content to render inside the `into` element.
   */
  children: Renderable;
}

/**
 * Render content into any element on the page.
 */
export function Portal(props: PortalProps) {
  const context = $$context();
  context.setName("dolla:Portal");

  let parent: Element;

  if (isString(props.into)) {
    const match = document.querySelector(props.into);
    if (match == null) {
      throw new Error(`Portal: selector '${props.into}' did not match any element`);
    }
    parent = match;
  } else {
    parent = props.into;
  }

  return new PortalNode(context, props.children, parent);
}
