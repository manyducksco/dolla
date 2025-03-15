import { isFunction, isObject, isString } from "../../typeChecking.js";
import { omit } from "../../utils.js";
import { type ElementContext } from "../context.js";
import { constructMarkup, toMarkup, type Markup, type MarkupElement } from "../markup.js";
import { type Ref } from "../ref.js";
import { effect, get, isReactive, type MaybeReactive, type UnsubscribeFunction } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

const isCamelCaseEventName = (key: string) => /^on[A-Z]/.test(key);

type HTMLOptions = {
  elementContext: ElementContext;
  tag: string;
  props: Record<string, any>;
  children?: any[];
};

export class HTML implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode;
  private props: Record<string, any>;
  private childMarkup: Markup[] = [];
  private children: MarkupElement[] = [];
  private unsubscribers: UnsubscribeFunction[] = [];
  private elementContext;

  // Track the ref so we can nullify it on unmount.
  private ref?: Ref<any>;

  // Prevents 'onClickOutside' handlers from firing in the same cycle in which the element is connected.
  private canClickAway = false;

  get isMounted() {
    return this.domNode.parentNode != null;
  }

  constructor({ tag, props, children, elementContext }: HTMLOptions) {
    // This and all nested views will be created as SVG elements.
    if (tag.toLowerCase() === "svg") {
      elementContext = {
        ...elementContext,
        isSVG: true,
      };
    }

    // Create node with the appropriate constructor.
    if (elementContext.isSVG) {
      this.domNode = document.createElementNS("http://www.w3.org/2000/svg", tag);
    } else {
      this.domNode = document.createElement(tag);
    }

    if (elementContext.root.getEnv() === "development" && elementContext.viewName) {
      this.domNode.dataset.view = elementContext.viewName;
    }

    if (props.ref) {
      if (isFunction(props.ref)) {
        this.ref = props.ref;
        this.ref(this.domNode);
      } else {
        throw new Error("Expected ref to be a function. Got: " + props.ref);
      }
    }

    this.props = {
      ...omit(["ref", "class", "className"], props),
      class: props.className ?? props.class,
    };

    if (children) {
      this.childMarkup = toMarkup(children);
    }

    this.elementContext = elementContext;
  }

  mount(parent: Node, after?: Node) {
    if (parent == null) {
      throw new Error(`HTML element requires a parent element as the first argument to connect. Got: ${parent}`);
    }

    if (!this.isMounted) {
      if (this.childMarkup.length > 0) {
        this.children = constructMarkup(this.elementContext, this.childMarkup);
      }

      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        const previous = i > 0 ? this.children[i - 1].domNode : undefined;
        child.mount(this.domNode, previous);
      }

      this.applyProps(this.domNode, this.props);
      if (this.props.style) this.applyStyles(this.domNode, this.props.style, this.unsubscribers);
      if (this.props.class) this.applyClasses(this.domNode, this.props.class, this.unsubscribers);
    }

    parent.insertBefore(this.domNode, after?.nextSibling ?? null);

    setTimeout(() => {
      this.canClickAway = true;
    }, 0);
  }

  unmount(parentIsUnmounting = false) {
    if (this.isMounted) {
      if (!parentIsUnmounting) {
        this.domNode.parentNode?.removeChild(this.domNode);
      }

      for (const child of this.children) {
        child.unmount(true);
      }

      if (this.ref) {
        this.ref(undefined);
      }

      this.canClickAway = false;

      for (const unsubscribe of this.unsubscribers) {
        unsubscribe();
      }
      this.unsubscribers.length = 0;
    }
  }

  private attachProp<T>(value: MaybeReactive<T>, callback: (value: T) => void) {
    if (isReactive(value)) {
      this.unsubscribers.push(
        effect(() => {
          callback(value.get());
        }),
      );
    } else {
      callback(value);
    }
  }

  private applyProps(element: HTMLElement | SVGElement, props: Record<string, unknown>) {
    for (const key in props) {
      const value = props[key];

      // TODO: If key starts with 'attr:' it is applied with .setAttribute, if 'prop:' it is set directly on the element. If 'on:' it is applied with .addEventListener

      if (key === "on:clickoutside" || key === "onClickOutside" || key === "onclickoutside") {
        const listener = (e: Event) => {
          if (this.canClickAway && !element.contains(e.target as any)) {
            if (isReactive<(e: Event) => void>(value)) {
              value.peek()(e);
            } else {
              (value as (e: Event) => void)(e);
            }
          }
        };

        const options = { capture: true };

        window.addEventListener("click", listener, options);

        this.unsubscribers.push(() => {
          window.removeEventListener("click", listener, options);
        });
      } else if (isCamelCaseEventName(key)) {
        const eventName = key.slice(2).toLowerCase();

        const listener: (e: Event) => void = isReactive<(e: Event) => void>(value)
          ? (e: Event) => value.peek()(e)
          : (value as (e: Event) => void);

        element.addEventListener(eventName, listener);

        this.unsubscribers.push(() => {
          element.removeEventListener(eventName, listener);
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
      } else if (!privateProps.includes(key)) {
        if (this.elementContext.isSVG) {
          this.attachProp(value, (current) => {
            if (current != null) {
              element.setAttribute(key, String(props[key]));
            } else {
              element.removeAttribute(key);
            }
          });
        } else {
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
              if (key.startsWith("prop:")) {
                const _key = key.substring(5);
                this.attachProp(value, (current) => {
                  (element as any)[_key] = current;
                });
              } else if (key.startsWith("on:")) {
                const _key = key.substring(3);
                let _prev: EventListener | undefined;
                this.attachProp(value as MaybeReactive<EventListener>, (current) => {
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
              } else if (key.startsWith("attr:")) {
                const _key = key.substring(5).toLowerCase();
                this.attachProp(value, (current) => {
                  if (current != null) {
                    element.setAttribute(_key, String(current));
                  } else {
                    element.removeAttribute(_key);
                  }
                });
              } else {
                this.attachProp(value, (current) => {
                  (element as any)[key] = current;
                });
              }

              break;
            }
          }
        }
      }
    }
  }

  private applyStyles(element: HTMLElement | SVGElement, styles: unknown, unsubscribers: UnsubscribeFunction[]) {
    const propUnsubscribers: UnsubscribeFunction[] = [];

    if (isReactive(styles)) {
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

        if (isReactive(value)) {
          const unsubscribe = effect(() => {
            if (value.get()) {
              element.style.setProperty(name, String(value.get()), priority);
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

  private applyClasses(element: HTMLElement | SVGElement, classes: unknown, unsubscribers: UnsubscribeFunction[]) {
    const classUnsubscribers: UnsubscribeFunction[] = [];

    if (isReactive(classes)) {
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

        if (isReactive(value)) {
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

/**
 * Converts a camelCase string to kebab-case.
 */
export function camelToKebab(value: string): string {
  return value.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());
}

// Attributes in this list will not be forwarded to the DOM node.
const privateProps = ["ref", "children", "class", "style", "data"];
