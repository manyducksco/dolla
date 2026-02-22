import { View } from "../types";
import { PARENT_ELEMENT } from "./app";
import { Context } from "./context";
import { ViewNode } from "./nodes/view";

type UnmountFn = () => void;

/**
 * Finds the element `selector` refers to in the document, then mounts `view` as a child of it.
 * Returns a function that unmounts `view`.
 */
export function mount(selector: string, view: View<{}>): UnmountFn;

/**
 * Mounts the view as a child of the parent element. Returns a function that unmounts the view.
 */
export function mount(parent: Element, view: View<{}>): UnmountFn;

export function mount(target: string | Element, view: View<{}>): UnmountFn {
  const parent = getElement(target);

  const context = new Context("dolla:mount");
  context.setState(PARENT_ELEMENT, parent);

  context.emit("willMount");
  const root = new ViewNode(context, view, {});
  root.mount(parent);
  context.emit("didMount");

  return function unmount() {
    if (!context.isMounted()) return;

    context.emit("willUnmount");
    root.unmount(false);
    context.emit("didUnmount");
  };
}

function getElement(element: string | Element): Element {
  if (typeof element === "string") {
    const match = document.querySelector(element);
    if (!match) {
      throw new Error(`Selector '${element}' did not many any element.`);
    }
    return match;
  } else if (element instanceof Element) {
    return element;
  } else {
    throw new Error("Expected a selector string or DOM element.");
  }
}
