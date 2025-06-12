import { isFunction, isObject, isString } from "../../typeChecking.js";
import { omit, toArray, toCamelCase } from "../../utils.js";
import { Context, LifecycleEvent } from "../context.js";
import { getEnv } from "../env.js";
import { toMarkupNodes, type MarkupNode } from "../markup.js";
import { effect, get, type MaybeSignal, type Signal, type Source, type UnsubscribeFn } from "../signals.js";
import { MARKUP_NODE, TYPE } from "../symbols.js";
import { VIEW, ViewInstance } from "./view.js";

const isCamelCaseEventName = (key: string) => /^on[A-Z]/.test(key);

const IS_SVG = Symbol("HTML.isSVG");

// Attributes in this list will not be forwarded to the DOM node.
const privateProps = ["class", "className", "ref", "mixin", "children"];

export class HTML implements MarkupNode {
  [TYPE] = MARKUP_NODE;

  root: HTMLElement | SVGElement;

  private parentContext: Context;
  private context: Context;

  tag;
  props: Record<string, any>;

  private childNodes: MarkupNode[] = [];
  private unsubscribers: UnsubscribeFn[] = [];

  // Track the ref so we can nullify it on unmount.
  private ref?: Source<any>;

  // Prevents 'onClickOutside' handlers from firing in the same cycle in which the element is connected.
  private canClickAway = false;

  constructor(context: Context, tag: string, props: Record<string, any>) {
    this.parentContext = context;
    this.tag = tag;
    this.props = props;

    this.context = Context.linked(this.parentContext, getLoggerName.bind(this));

    // This and all nested views will be created as SVG elements.
    if (tag.toLowerCase() === "svg") {
      this.context.setState(IS_SVG, true);
    }

    // Create node with the appropriate constructor.
    if (this.context.getState(IS_SVG, false)) {
      this.root = document.createElementNS("http://www.w3.org/2000/svg", tag);
    } else {
      this.root = document.createElement(tag);
    }

    // Add view name as a data attribute in development mode for better debugging.
    if (getEnv() === "development") {
      const view = this.context.getState<ViewInstance<any> | null>(VIEW, null);
      if (view) {
        this.root.dataset.view = view.context.getName();
      }
    }

    if (props.mixin) {
      for (const fn of toArray(props.mixin)) {
        fn(
          this.root,
          Context.linked(this.context, getLoggerName.bind(this), {
            bindLifecycleToParent: true,
            logger: { tagName: fn.name === "mixin" ? undefined : "mixin", tag: fn.name },
          }),
        );
      }
    }

    const classes = props.className ?? props.class;

    this.applyProps(this.root, omit(privateProps, props));
    if (props.style) this.applyStyles(this.root, props.style, this.unsubscribers);
    if (classes) this.applyClasses(this.root, classes, this.unsubscribers);

    if (props.ref) {
      if (isFunction(props.ref)) {
        this.ref = props.ref;
        this.ref(this.root);
      } else {
        throw new Error("Expected ref to be a function. Got: " + props.ref);
      }
    }

    if (props.children) {
      this.childNodes = toMarkupNodes(this.context, props.children);
    }
  }

  isMounted() {
    return this.context.isMounted;
    // return this.root?.parentNode != null;
  }

  mount(parent: Node, after?: Node) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      Context.emit(this.context, LifecycleEvent.WILL_MOUNT);

      for (let i = 0; i < this.childNodes.length; i++) {
        const child = this.childNodes[i];
        const previous = i > 0 ? this.childNodes[i - 1].root : undefined;
        child.mount(this.root!, previous);
      }
    }

    parent.insertBefore(this.root!, after?.nextSibling ?? null);

    this.canClickAway = true;

    if (!wasMounted) Context.emit(this.context, LifecycleEvent.DID_MOUNT);
  }

  unmount(skipDOM = false) {
    Context.emit(this.context, LifecycleEvent.WILL_UNMOUNT);

    if (!skipDOM) {
      this.root!.parentNode?.removeChild(this.root!);
    }

    for (const child of this.childNodes) {
      child.unmount(true);
    }

    this.canClickAway = false;

    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;

    if (this.ref) {
      this.ref(undefined);
    }

    Context.emit(this.context, LifecycleEvent.DID_UNMOUNT);
    Context.emit(this.context, LifecycleEvent.DISPOSE);
  }

  move(parent: Element, after?: Node) {
    if ("moveBefore" in parent) {
      try {
        (parent as any).moveBefore(this.root!, after?.nextSibling ?? null);
      } catch {
        this.mount(parent, after);
      }
    } else {
      this.mount(parent, after);
    }
  }

  private attachProp<T>(value: MaybeSignal<T>, callback: (value: T) => void) {
    if (isFunction(value)) {
      this.unsubscribers.push(
        effect(() => {
          try {
            callback((value as Signal<T>)());
          } catch (error) {
            this.context.error(error);
            this.context.crash(error as Error);
          }
        }),
      );
    } else {
      callback(value);
    }
  }

  private applyProps(element: HTMLElement | SVGElement, props: Record<string, unknown>) {
    for (const key in props) {
      const value = props[key];

      if (key === "on:clickoutside" || key === "onClickOutside" || key === "onclickoutside") {
        // Synthetic onclickoutside event.

        const listener = (e: Event) => {
          if (this.canClickAway && !element.contains(e.target as any)) {
            (value as (e: Event) => void)(e);
          }
        };

        // Capture is set to avoid intermediate elements cancelling this event before it gets to the window.
        const options = { capture: true };

        window.addEventListener("click", listener, options);
        this.unsubscribers.push(() => {
          window.removeEventListener("click", listener, options);
        });
      } else if (key.startsWith("prop:")) {
        // Keys starting with `prop:` are set as props.

        const _key = key.substring(5);
        this.attachProp(value, (current) => {
          (element as any)[_key] = current;
        });
      } else if (key.startsWith("on:")) {
        // Keys starting with `on:` are treated as event listeners.

        const _key = key.substring(3);
        let _prev: EventListener | undefined;
        if (isFunction(value)) {
          element.addEventListener(_key, value as EventListener);
          this.unsubscribers.push(() => {
            element.removeEventListener(_key, value as EventListener);
          });
        } else {
          this.attachProp(value as MaybeSignal<EventListener>, (current) => {
            if (!current && _prev) {
              element.removeEventListener(_key, _prev);
            } else if (current != null) {
              if (_prev && _prev !== current) {
                element.removeEventListener(_key, _prev);
              }
              element.addEventListener(_key, current);
            }
            _prev = current;
          });
        }
      } else if (key.startsWith("attr:")) {
        // Keys starting with `attr:` are set as attributes.

        const _key = key.substring(5).toLowerCase();
        this.attachProp(value, (current) => {
          if (current != null) {
            element.setAttribute(_key, String(current));
          } else {
            element.removeAttribute(_key);
          }
        });
      } else if (isFunction(value) && isCamelCaseEventName(key)) {
        // camelCase event names are applied with addEventListener.

        const eventName = key.slice(2).toLowerCase();

        const listener: (e: Event) => void = value as (e: Event) => void;

        element.addEventListener(eventName, listener);
        this.unsubscribers.push(() => {
          element.removeEventListener(eventName, listener);
        });
      } else if (key.startsWith("on") && isFunction(value) && knownEventNames.includes(key.substring(2))) {
        // Event handler properties (element.onsomething = function () {})

        (element as any)[key] = value;
        this.unsubscribers.push(() => {
          (element as any)[key] = undefined;
        });
      } else if (key.includes("-")) {
        // Names with dashes in them are not valid prop names, so they are treated as attributes.

        this.attachProp(value, (current) => {
          if (current == null) {
            element.removeAttribute(key);
          } else {
            element.setAttribute(key, String(current));
          }
        });
      } else if (this.context.getState(IS_SVG, false)) {
        // SVG gets everything set as an attribute.

        // TODO: This isn't exactly right. SVGElement supports props as well.
        this.attachProp(value, (current) => {
          if (current != null) {
            element.setAttribute(key, String(props[key]));
          } else {
            element.removeAttribute(key);
          }
        });
      } else {
        // Special handling for other props on a case by case basis.

        switch (key) {
          case "contentEditable":
          case "value":
            this.attachProp(value, (current) => {
              (element as any)[key] = String(current);
            });
            break;

          case "for":
            this.attachProp(value, (current) => {
              (element as any).htmlFor = current;
            });
            break;

          case "innerHTML":
            this.attachProp(value, (current) => {
              (element as any).innerHTML = current;
            });
            break;

          case "title":
            this.attachProp(value, (current) => {
              if (current == null) {
                (element as any).removeAttribute(key);
              } else {
                (element as any).setAttribute(key, String(current));
              }
            });

          case "checked":
            this.attachProp(value, (current) => {
              (element as any).checked = current;

              // Set attribute also or styles don't take effect.
              if (current) {
                element.setAttribute("checked", "");
              } else {
                element.removeAttribute("checked");
              }
            });
            break;

          case "dataset":
            let applied: Record<string, string> = {};
            this.attachProp(value, (_next) => {
              if (isObject(_next)) {
                // Convert keys to camelCase and make sure values are strings.
                const next: Record<string, string> = {};
                for (const _key in _next) {
                  next[toCamelCase(_key)] = String(_next[_key]);
                }

                for (const key in applied) {
                  // Key removed.
                  if (Object.hasOwn(applied, key) && !Object.hasOwn(next, key)) {
                    delete element.dataset[key];
                    delete applied[key];
                  }
                }

                for (const key in next) {
                  // Value changed (or not set).
                  if (applied[key] !== next[key]) {
                    element.dataset[key] = next[key];
                    applied[key] = next[key];
                  }
                }
              } else {
                for (const key in applied) {
                  delete element.dataset[key];
                }
              }
            });
            break;

          case "autocomplete":
          case "autocapitalize":
            this.attachProp(value, (current) => {
              if (typeof current === "string") {
                (element as any)[key] = current;
              } else if (current) {
                (element as any)[key] = "on";
              } else {
                (element as any)[key] = "off";
              }
            });
            break;

          default: {
            // Fall back to setting as a property.
            this.attachProp(value, (current) => {
              (element as any)[key] = current;
            });
            break;
          }
        }
      }
    }
  }

  private applyStyles(element: HTMLElement | SVGElement, styles: unknown, unsubscribers: UnsubscribeFn[]) {
    const propUnsubscribers: UnsubscribeFn[] = [];

    if (isFunction(styles)) {
      let unapply: () => void;

      const unsubscribe = effect(() => {
        if (isFunction(unapply)) {
          unapply();
        }
        element.style.cssText = "";
        unapply = this.applyStyles(element, get(styles), unsubscribers);
      });

      unsubscribers.push(unsubscribe);
      propUnsubscribers.push(unsubscribe);
    } else {
      const mapped = getStyleMap(styles);

      for (const name in mapped) {
        const { value, priority } = mapped[name];

        if (isFunction(value)) {
          const unsubscribe = effect(() => {
            if (get(value)) {
              element.style.setProperty(name, String(get(value)), priority);
            } else {
              element.style.removeProperty(name);
            }
          });

          unsubscribers.push(unsubscribe);
          propUnsubscribers.push(unsubscribe);
        } else if (value != undefined) {
          element.style.setProperty(name, String(value));
        }
      }
    }

    return function unapply() {
      for (const unsubscribe of propUnsubscribers) {
        unsubscribe();
        unsubscribers.splice(unsubscribers.indexOf(unsubscribe), 1);
      }
    };
  }

  private applyClasses(element: HTMLElement | SVGElement, classes: unknown, unsubscribers: UnsubscribeFn[]) {
    const classUnsubscribers: UnsubscribeFn[] = [];

    if (isFunction(classes)) {
      let unapply: () => void;

      const unsubscribe = effect(() => {
        if (isFunction(unapply)) {
          unapply();
        }
        element.removeAttribute("class");
        unapply = this.applyClasses(element, get(classes), unsubscribers);
      });

      unsubscribers.push(unsubscribe);
      classUnsubscribers.push(unsubscribe);
    } else {
      const mapped = getClassMap(classes);

      for (const name in mapped) {
        const value = mapped[name];

        if (isFunction(value)) {
          const unsubscribe = effect(() => {
            if (get(value)) {
              element.classList.add(name);
            } else {
              element.classList.remove(name);
            }
          });

          unsubscribers.push(unsubscribe);
          classUnsubscribers.push(unsubscribe);
        } else if (value) {
          element.classList.add(name);
        }
      }
    }

    return function unapply() {
      for (const unsubscribe of classUnsubscribers) {
        unsubscribe();
        unsubscribers.splice(unsubscribers.indexOf(unsubscribe), 1);
      }
    };
  }
}

/**
 * Parse classes into a single object. Classes can be passed as a string, an object with class keys can boolean values, or an array with a mix of both.
 */
function getClassMap(classes: unknown) {
  let mapped: Record<string, boolean> = {};

  if (isString(classes)) {
    // Support multiple classes in one string like HTML.
    const names = classes.split(" ");
    for (const name of names) {
      mapped[name] = true;
    }
  } else if (isObject(classes)) {
    Object.assign(mapped, classes);
  } else if (Array.isArray(classes)) {
    Array.from(classes)
      .filter(Boolean)
      .forEach((item) => {
        Object.assign(mapped, getClassMap(item));
      });
  }

  // Delete undefined keys. These are usually the result of a class that is not specified in the stylesheet and would have no effect on appearance.
  delete mapped["undefined"];

  return mapped;
}

/**
 * Parse styles into a single object.
 */
function getStyleMap(styles: unknown) {
  let mapped: Record<string, { value: unknown; priority?: string }> = {};

  if (isString(styles)) {
    const lines = styles.split(";").filter((line) => line.trim() !== "");
    for (const line of lines) {
      const [key, _value] = line.split(":");
      const entry: { value: unknown; priority?: string } = {
        value: _value,
      };
      if (_value.includes("!important")) {
        entry.priority = "important";
        entry.value = _value.replace("!important", "").trim();
      } else {
        entry.value = _value.trim();
      }
      mapped[camelToKebab(key.trim())] = entry;
    }
  }
  if (isObject(styles)) {
    for (const key in styles) {
      if (key.startsWith("--")) {
        // Pass through variable names without processing.
        mapped[key] = { value: styles[key] };
      } else {
        mapped[camelToKebab(key)] = { value: styles[key] };
      }
    }
  } else if (Array.isArray(styles)) {
    Array.from(styles)
      .filter((item) => item != null)
      .forEach((item) => {
        Object.assign(mapped, getStyleMap(item));
      });
  }

  return mapped;
}

function getLoggerName(this: HTML) {
  if (this.root == null) return this.tag;
  let name = this.root.tagName.toLowerCase();
  if (this.root.id) {
    name += `#${this.root.id}`;
  }
  if (this.root.classList.length > 0) {
    for (const className of this.root.classList.values()) {
      name += `.${className}`;
    }
  }
  return name;
}

/**
 * Converts a camelCase string to kebab-case.
 */
function camelToKebab(value: string): string {
  return value.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());
}

// A list of all known event names. These will be handled as event listeners.
const knownEventNames = [
  // Element
  "animationcancel",
  "animationend",
  "animationiteration",
  "animationstart",
  "auxclick",
  "beforeinput",
  "beforematch",
  "beforexrselect",
  "blur",
  "click",
  "compositionend",
  "compositionstart",
  "compositionupdate",
  "contentvisibilityautostatechange",
  "contextmenu",
  "copy",
  "cut",
  "dblclick",
  "focus",
  "focusin",
  "focusout",
  "fullscreenchange",
  "fullscreenerror",
  "gotpointercapture",
  "input",
  "keydown",
  "keyup",
  "lostpointercapture",
  "mousedown",
  "mouseenter",
  "mouseleave",
  "mousemove",
  "mouseout",
  "mouseover",
  "mouseup",
  "paste",
  "pointercancel",
  "pointerdown",
  "pointerenter",
  "pointerleave",
  "pointermove",
  "pointerout",
  "pointerover",
  "pointerrawupdate",
  "pointerup",
  "scroll",
  "scrollend",
  "scrollsnapchange",
  "scrollsnapchanging",
  "securitypolicyviolation",
  "touchcancel",
  "touchend",
  "touchmove",
  "touchstart",
  "transitioncancel",
  "transitionend",
  "transitionrun",
  "transitionstart",
  "webkitmouseforcechanged",
  "webkitmouseforcedown",
  "webkitmouseforceup",
  "webkimouseforcewillbegin",
  "wheel",

  // HTMLElement
  "beforetoggle",
  "change",
  "command",
  "drag",
  "dragend",
  "dragenter",
  "dragleave",
  "dragover",
  "dragstart",
  "drop",
  "error",
  "load",
  "toggle",

  // HTMLInputElement
  "cancel",
  "invalid",
  "search",
  "select",
  "selectionchange",

  // HTMLFormElement
  "formdata",
  "reset",
  "submit",
];
