import { isString } from "../../typeChecking";
import type { Renderable } from "../../types";
import { useContext } from "../hooks";
import { Markup, MarkupType } from "../markup";

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
  const context = useContext("Portal");

  let parent: Element;

  if (isString(props.into)) {
    const match = document.querySelector(props.into);
    if (match == null) {
      throw context.crash(new Error(`Portal: selector '${props.into}' did not match any element`));
    }
    parent = match;
  } else {
    parent = props.into;
  }

  return new Markup(MarkupType.Portal, {
    parent: props.into,
    content: props.children,
  });
}
