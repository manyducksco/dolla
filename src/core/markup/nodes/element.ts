import { isArray, isFunction, isNumber, isObject, isString, omit } from "../../../utils.js";
import { cleanupContext, Context, createContext, getNearestViewNode, mountContext } from "../../context.js";
import { Ref } from "../../ref.js";
import { type Getter, subscribe } from "../../signals.js";
import { DEBUG } from "../../symbols.js";
import { isCSSTemplate } from "../css.js";
import { scheduleUpdate } from "../scheduler.js";
import { MarkupNode, MountTarget } from "../types.js";
import { addChild, addListener, toMarkupNodes } from "../utils.js";

const IS_SVG = Symbol.for("$_IS_SVG");

// Properties in this list will not be processed by applyProps because they are already handled elsewhere.
const ignoredProps = ["ref", "children"];

type ElementRoot = HTMLElement | SVGElement;

/**
 * Renders an HTML or SVG element.
 */
export class ElementNode extends MarkupNode {
  #root: ElementRoot;

  readonly #props: Record<string, any>;

  #context: Context;
  #childNodes: MarkupNode[] = [];
  #unsubscribers = new Set<() => void>();

  #styleClasses: string[] | undefined;

  #refCleanup?: () => void;

  constructor(context: Context, tag: string, props: Record<string, any>) {
    super();

    this.#props = props;
    this.#context = createContext(context);

    if (props) {
      const classes = props.class ?? props.className;
      if (classes && isString(classes) && classes.trim() === "") {
        throw new Error(`Empty class string will cause a DOMException.`);
      }
    }

    if (tag === "svg") {
      // This and all nested views will be created as SVG elements.
      this.#context[IS_SVG] = true;
    } else if (this.#context[IS_SVG] && tag === "foreignObject") {
      // No longer in SVG.
      this.#context[IS_SVG] = false;
    }

    // Create node with the appropriate constructor.
    if (this.#context[IS_SVG]) {
      this.#root = document.createElementNS("http://www.w3.org/2000/svg", tag);
    } else {
      this.#root = document.createElement(tag);
    }

    // Add view name as a data attribute debug mode.
    if (this.#context[DEBUG]) {
      const view = getNearestViewNode(this.#context);
      if (view) {
        this.#root.dataset.view = view.context.name;
      }
    }
  }

  override getRoot(): ElementRoot {
    return this.#root;
  }

  override isMounted() {
    return this.#root.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      this.#applyProps(this.#root, omit(ignoredProps, this.#props));

      if (this.#props.children) {
        this.#childNodes = toMarkupNodes(this.#context, this.#props.children);
        for (const child of this.#childNodes) {
          child.mount(this.#root);
        }
      }
    }

    const targetSibling = after?.nextSibling ?? null;
    if (this.#root.parentNode !== parent || this.#root.nextSibling !== targetSibling) {
      addChild(parent, this.#root, after);
    }

    if (!wasMounted) {
      if (isFunction<Ref<any>>(this.#props.ref)) {
        const result = this.#props.ref(this.#root);
        if (isFunction(result)) {
          this.#refCleanup = result;
        }
      }

      mountContext(this.#context);
    }
  }

  override unmount(skipDOM = false) {
    if (!skipDOM && this.#root.parentNode) {
      this.#root.parentNode.removeChild(this.#root);
    }

    for (const child of this.#childNodes) {
      child.unmount(true); // Skip DOM removal for children
    }

    // Clear reactivity
    this.#unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.#unsubscribers.clear();

    cleanupContext(this.#context);

    // Clear ref
    if (this.#refCleanup) {
      this.#refCleanup();
      this.#refCleanup = undefined;
    }

    // Release memory
    this.#childNodes.length = 0;
  }

  override move(parent: MountTarget, after?: Node) {
    if (parent.moveBefore) {
      try {
        parent.moveBefore(this.#root, after?.nextSibling ?? null);
        return;
      } catch {}
    }
    this.mount(parent, after);
  }

  #attach<T>(value: Getter<T> | T, callback: (value: T) => void) {
    if (isFunction<Getter<T>>(value)) {
      this.#unsubscribers.add(
        subscribe(value, (current) => {
          scheduleUpdate(() => callback(current));
        }),
      );
    } else {
      // No need to schedule since DOM node is not connected yet.
      callback(value);
    }
  }

  #applyProps(element: any, props: Record<string, unknown>) {
    for (const key in props) {
      const value = props[key];

      if (key === "style") {
        this.#applyStyles(element, value);
      } else if (key === "class" || key === "className") {
        this.#applyClasses(element, value);
      } else if (key === "for") {
        this.#attach(value, (current) => {
          element.htmlFor = current;
        });
      } else if (key[0] === "." || key.startsWith("prop:")) {
        // Keys starting with `.` or `prop:` are set as props.

        const _key = key.substring(5);
        this.#attach(value, (current) => {
          element[_key] = current;
        });
      } else if (key[0] === ":" || key.startsWith("attr:")) {
        // Keys starting with `:` or `attr:` are set as attributes.

        const _key = key.substring(5).toLowerCase();
        this.#attach(value, (current) => {
          setAttribute(element, _key, current);
        });
      } else if (key[0] === "@" && isFunction(value)) {
        // Anything that's a function starting with `@` is an event listener.

        const eventName = key.substring(1);
        this.#unsubscribers.add(addListener(element, eventName, value));
      } else if (key.startsWith("on") && isFunction(value)) {
        // Anything that's a function starting with `on` is an event listener.

        const eventName = key.toLowerCase().slice(2);
        this.#unsubscribers.add(addListener(element, eventName, value));
      } else if (key in element && !this.#context[IS_SVG]) {
        // Set as property if the element has one.

        if (typeof element[key] === "boolean") {
          this.#attach(value, (current) => {
            const isTrue = Boolean(current);
            element[key] = isTrue;
            setAttribute(element, key, isTrue);
          });
        } else {
          this.#attach(value, (current) => {
            element[key] = current;
          });
        }
      } else {
        // Fall back to attributes.

        this.#attach(value, (current) => {
          setAttribute(element, key, current);
        });
      }
    }
  }

  #applyStyles(element: HTMLElement | SVGElement, styles: unknown) {
    if (isCSSTemplate(styles)) {
      styles.attach(this.#context, element);
      return; // TODO: Support template in an array with object, string, etc?
    }

    const localUnsubs = new Set<() => void>();

    const apply = (current: unknown) => {
      localUnsubs.forEach((unsub) => {
        unsub();
        this.#unsubscribers.delete(unsub);
      });
      localUnsubs.clear();
      element.style.cssText = "";

      const mapped = getStyleMap(current);
      for (const [name, { value, priority }] of Object.entries(mapped)) {
        if (isFunction(value)) {
          const unsub = subscribe(value, (v) => {
            if (v) element.style.setProperty(name, formatValue(name, v), priority);
            else element.style.removeProperty(name);
          });
          this.#unsubscribers.add(unsub);
          localUnsubs.add(unsub);
        } else if (value != null) {
          element.style.setProperty(name, formatValue(name, value), priority);
        }
      }
    };

    if (isFunction(styles)) {
      this.#unsubscribers.add(subscribe(styles, apply));
    } else {
      apply(styles);
    }
  }

  #applyClasses(element: HTMLElement | SVGElement, classes: unknown) {
    const localUnsubs = new Set<() => void>();

    const apply = (current: unknown) => {
      // Clean up nested subscriptions if the top-level signal emits a new object
      localUnsubs.forEach((unsub) => {
        unsub();
        this.#unsubscribers.delete(unsub);
      });
      localUnsubs.clear();

      const mapped = getClassMap(current);

      for (const [name, value] of Object.entries(mapped)) {
        if (name === "undefined") continue;

        if (isFunction(value)) {
          const unsub = subscribe(value, (isActive) => element.classList.toggle(name, !!isActive));
          this.#unsubscribers.add(unsub);
          localUnsubs.add(() => {
            // Remove self when locally unsubbed.
            element.classList.remove(name);
            unsub();
          });
        } else if (value) {
          element.classList.add(name);
        }
      }
    };

    if (isFunction(classes)) {
      this.#unsubscribers.add(subscribe(classes, apply));
    } else {
      apply(classes);
    }
  }
}

/**
 * Parse classes into a single object. Classes can be passed as a string, an object with class keys can boolean values, or an array with a mix of both.
 */
function getClassMap(classes: unknown): Record<string, unknown> {
  if (isString(classes)) return Object.fromEntries(classes.split(" ").map((c) => [c, true]));
  if (isArray(classes)) return Object.assign({}, ...classes.filter(Boolean).map(getClassMap));
  if (isObject(classes)) return classes as Record<string, unknown>;
  return {};
}

/**
 * Parse styles into a single object.
 */
function getStyleMap(styles: unknown): Record<string, { value: unknown; priority?: string }> {
  if (isString(styles)) {
    return Object.fromEntries(
      styles
        .split(";")
        .filter((s) => s.trim())
        .map((line) => {
          const [key, val] = line.split(":");
          return [
            camelToKebab(key.trim()),
            {
              value: val.replace("!important", "").trim(),
              priority: val.includes("!important") ? "important" : "",
            },
          ];
        }),
    );
  }
  if (isArray(styles)) return Object.assign({}, ...styles.filter(Boolean).map(getStyleMap));
  if (isObject(styles)) {
    return Object.fromEntries(
      Object.entries(styles).map(([k, v]) => [k.startsWith("--") ? k : camelToKebab(k), { value: v }]),
    );
  }
  return {};
}

/**
 * Converts a camelCase string to kebab-case.
 */
function camelToKebab(value: string): string {
  return value.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());
}

const acceptsUnitless = new Set<string>([
  "animation-iteration-count",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex",
  "box-flex-group",
  "box-ordinal-group",
  "column-count",
  "columns",
  "flex",
  "flex-grow",
  "flex-positive",
  "flex-shrink",
  "flex-negative",
  "flex-order",
  "grid-row",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "grid-column",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "font-weight",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
  // SVG attributes
  "fill-opacity",
  "flood-opacity",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
]);
function formatValue(name: string, value: any): string {
  if (isNumber(value) && value !== 0 && !acceptsUnitless.has(name)) {
    return `${value}px`;
  } else {
    return String(value);
  }
}

function setAttribute(element: Element, name: string, value: any) {
  if (value) {
    element.setAttribute(name, String(value));
  } else {
    element.removeAttribute(name);
  }
}
