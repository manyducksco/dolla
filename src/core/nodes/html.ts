import { isFunction, isObject, isString } from "../../typeChecking.js";
import { getUniqueId, omit } from "../../utils.js";
import { constructMarkup, type ElementContext, type Markup, type MarkupElement } from "../markup.js";
import {
  isRef,
  isSettableState,
  isState,
  type Ref,
  type SettableState,
  type State,
  type StopFunction,
} from "../state.js";
import { TYPE_MARKUP_ELEMENT } from "../symbols.js";

//const eventHandlerProps = Object.values(eventPropsToEventNames).map((event) => "on" + event);
const isCamelCaseEventName = (key: string) => /^on[A-Z]/.test(key);

type HTMLOptions = {
  elementContext: ElementContext;
  tag: string;
  props: Record<string, any>;
  children?: Markup[];
};

export class HTML implements MarkupElement {
  [TYPE_MARKUP_ELEMENT] = true;

  node;
  props: Record<string, any>;
  children: MarkupElement[];
  stopCallbacks: StopFunction[] = [];
  elementContext;
  uniqueId = getUniqueId();

  _batchWrite;

  // Track the ref so we can nullify it on unmount.
  ref?: Ref<any>;

  // Prevents 'onClickOutside' handlers from firing in the same cycle in which the element is connected.
  canClickAway = false;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ tag, props, children, elementContext }: HTMLOptions) {
    elementContext = { ...elementContext };

    this._batchWrite = elementContext.root.batch.write.bind(elementContext.root.batch);

    // This and all nested views will be created as SVG elements.
    if (tag.toLowerCase() === "svg") {
      elementContext.isSVG = true;
    }

    // Create node with the appropriate constructor.
    if (elementContext.isSVG) {
      this.node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    } else {
      this.node = document.createElement(tag);
    }

    // Add unique ID to attributes for debugging purposes.
    if (elementContext.root.getEnv() === "development") {
      this.node.dataset.uniqueId = this.uniqueId;
    }

    if (props.ref) {
      if (isRef(props.ref)) {
        this.ref = props.ref;
        this.ref.node = this.node;
      } else {
        throw new Error("Expected ref to be a Ref object. Got: " + props.ref);
      }
    }

    this.props = {
      ...omit(["ref", "class", "className"], props),
      class: props.className ?? props.class,
    };
    this.children = children ? constructMarkup(elementContext, children) : [];
    this.elementContext = elementContext;
  }

  mount(parent: Node, after?: Node) {
    if (parent == null) {
      throw new Error(`HTML element requires a parent element as the first argument to connect. Got: ${parent}`);
    }

    if (!this.isMounted) {
      for (const child of this.children) {
        child.mount(this.node);
      }

      this.applyProps(this.node, this.props);
      if (this.props.style) this.applyStyles(this.node, this.props.style, this.stopCallbacks);
      if (this.props.class) this.applyClasses(this.node, this.props.class, this.stopCallbacks);
    }

    parent.insertBefore(this.node, after?.nextSibling ?? null);

    setTimeout(() => {
      this.canClickAway = true;
    }, 0);
  }

  unmount(parentIsUnmounting = false) {
    if (this.isMounted) {
      for (const child of this.children) {
        child.unmount(true);
      }

      if (!parentIsUnmounting) {
        this.node.parentNode?.removeChild(this.node);
      }

      if (this.ref) {
        this.ref.node = undefined;
      }

      this.canClickAway = false;

      for (const stop of this.stopCallbacks) {
        stop();
      }
      this.stopCallbacks = [];
    }
  }

  getUpdateKey(type: string, value: string | number) {
    return `${this.uniqueId}:${type}:${value}`;
  }

  _mutate(callback: () => any, updateKey?: string) {
    if (!this.isMounted) {
      // DOM operations on nodes that aren't connected yet shouldn't cause any
      // layout thrashing. Just execute now.
      callback();
    } else {
      // If we are mounted we have to be more mindful of layout thrashing.
      // These mutations get batched.
      this._batchWrite(callback, updateKey);
    }
  }

  attachProp<T>(value: State<T> | T, callback: (value: T) => void, updateKey: string) {
    if (isState(value)) {
      this.stopCallbacks.push(
        value.watch((current) => {
          this._mutate(() => callback(current), updateKey);
        }),
      );
    } else {
      this._mutate(() => callback(value), updateKey);
    }
  }

  applyProps(element: HTMLElement | SVGElement, props: Record<string, unknown>) {
    for (const key in props) {
      const value = props[key];

      if (key === "attributes") {
        const values = value as Record<string, any>;
        // Set attributes directly without mapping props
        for (const name in values) {
          this.attachProp(
            values[name],
            (current) => {
              if (current == null) {
                (element as any).removeAttribute(name);
              } else {
                (element as any).setAttribute(name, String(current));
              }
            },
            this.getUpdateKey("attr", name),
          );
        }
      } else if (key === "eventListeners") {
        const values = value as Record<string, any>;

        for (const name in values) {
          const listener: (e: Event) => void = isState<(e: Event) => void>(value)
            ? (e: Event) => value.get()(e)
            : (value as (e: Event) => void);

          element.addEventListener(name, listener);

          this.stopCallbacks.push(() => {
            element.removeEventListener(name, listener);
          });
        }
      } else if (key === "onClickOutside" || key === "onclickoutside") {
        const listener = (e: Event) => {
          if (this.canClickAway && !element.contains(e.target as any)) {
            if (isState<(e: Event) => void>(value)) {
              value.get()(e);
            } else {
              (value as (e: Event) => void)(e);
            }
          }
        };

        const options = { capture: true };

        window.addEventListener("click", listener, options);

        this.stopCallbacks.push(() => {
          window.removeEventListener("click", listener, options);
        });
      } else if (key === "$$value") {
        // Two-way binding for input values.
        if (!isSettableState(value)) {
          throw new TypeError(`$$value attribute must be a settable state. Got: ${value}`);
        }

        // Read value from state.
        this.attachProp(
          value,
          (current) => {
            if (current == null) {
              (element as HTMLInputElement).value = "";
            } else {
              (element as HTMLInputElement).value = String(current);
            }
          },
          this.getUpdateKey("attr", "value"),
        );

        // Propagate value to state.
        const listener: EventListener = (e) => {
          // Attempt to cast value back to the same type stored in the state.
          const updated = toTypeOf(value.get(), (e.currentTarget as HTMLInputElement).value);
          (value as SettableState<any>).set(updated);
        };

        element.addEventListener("input", listener);

        this.stopCallbacks.push(() => {
          element.removeEventListener("input", listener);
        });
      } else if (isCamelCaseEventName(key)) {
        const eventName = key.slice(2).toLowerCase();

        const listener: (e: Event) => void = isState<(e: Event) => void>(value)
          ? (e: Event) => value.get()(e)
          : (value as (e: Event) => void);

        element.addEventListener(eventName, listener);

        this.stopCallbacks.push(() => {
          element.removeEventListener(eventName, listener);
        });
      } else if (key.includes("-")) {
        // Names with dashes in them are not valid prop names, so they are treated as attributes.
        this.attachProp(
          value,
          (current) => {
            if (current == null) {
              element.removeAttribute(key);
            } else {
              element.setAttribute(key, String(current));
            }
          },
          this.getUpdateKey("attr", key),
        );
      } else if (!privateProps.includes(key)) {
        if (this.elementContext.isSVG) {
          this.attachProp(
            value,
            (current) => {
              if (current != null) {
                element.setAttribute(key, String(props[key]));
              } else {
                element.removeAttribute(key);
              }
            },
            this.getUpdateKey("attr", key),
          );
        } else {
          switch (key) {
            case "contentEditable":
            case "value":
              this.attachProp(
                value,
                (current) => {
                  (element as any)[key] = String(current);
                },
                this.getUpdateKey("prop", key),
              );
              break;

            case "for":
              this.attachProp(
                value,
                (current) => {
                  (element as any).htmlFor = current;
                },
                this.getUpdateKey("prop", "htmlFor"),
              );
              break;

            case "checked":
              this.attachProp(
                value,
                (current) => {
                  (element as any).checked = current;

                  // Set attribute also or styles don't take effect.
                  if (current) {
                    element.setAttribute("checked", "");
                  } else {
                    element.removeAttribute("checked");
                  }
                },
                this.getUpdateKey("prop", "checked"),
              );
              break;

            // Attribute-aliased props
            case "exportParts":
            case "part":
            case "translate":
            case "type":
            case "title": {
              const _key = key.toLowerCase();
              this.attachProp(
                value,
                (current) => {
                  if (current == undefined) {
                    element.removeAttribute(_key);
                  } else {
                    element.setAttribute(_key, String(current));
                  }
                },
                this.getUpdateKey("attr", _key),
              );
              break;
            }

            case "autocomplete":
            case "autocapitalize":
              this.attachProp(
                value,
                (current) => {
                  if (typeof current === "string") {
                    (element as any).autocomplete = current;
                  } else if (current) {
                    (element as any).autocomplete = "on";
                  } else {
                    (element as any).autocomplete = "off";
                  }
                },
                this.getUpdateKey("prop", key),
              );
              break;

            default: {
              this.attachProp(
                value,
                (current) => {
                  (element as any)[key] = current;
                },
                this.getUpdateKey("prop", key),
              );
              break;
            }
          }
        }
      }
    }
  }

  applyStyles(element: HTMLElement | SVGElement, styles: unknown, stopCallbacks: StopFunction[]) {
    const propStopCallbacks: StopFunction[] = [];

    if (isState(styles)) {
      let unapply: () => void;

      const stop = styles.watch((current) => {
        this._mutate(
          () => {
            if (isFunction(unapply)) {
              unapply();
            }
            element.style.cssText = "";
            unapply = this.applyStyles(element, current, stopCallbacks);
          },
          this.getUpdateKey("styles", "*"),
        );
      });

      stopCallbacks.push(stop);
      propStopCallbacks.push(stop);
    } else {
      const mapped = getStyleMap(styles);

      for (const name in mapped) {
        const { value, priority } = mapped[name];

        if (isState(value)) {
          const stop = value.watch((current) => {
            this._mutate(() => {
              if (current) {
                element.style.setProperty(name, String(current), priority);
              } else {
                element.style.removeProperty(name);
              }
            }); // NOTE: Not keyed; all update callbacks must run to apply all properties.
          });

          stopCallbacks.push(stop);
          propStopCallbacks.push(stop);
        } else if (value != undefined) {
          element.style.setProperty(name, String(value));
        }
      }
    }

    return function unapply() {
      for (const stop of propStopCallbacks) {
        stop();
        stopCallbacks.splice(stopCallbacks.indexOf(stop), 1);
      }
    };
  }

  applyClasses(element: HTMLElement | SVGElement, classes: unknown, stopCallbacks: StopFunction[]) {
    const classStopCallbacks: StopFunction[] = [];

    if (isState(classes)) {
      let unapply: () => void;

      const stop = classes.watch((current) => {
        this._mutate(
          () => {
            if (isFunction(unapply)) {
              unapply();
            }
            element.removeAttribute("class");
            unapply = this.applyClasses(element, current, stopCallbacks);
          },
          this.getUpdateKey("attr", "class"),
        );
      });

      stopCallbacks.push(stop);
      classStopCallbacks.push(stop);
    } else {
      const mapped = getClassMap(classes);

      for (const name in mapped) {
        const value = mapped[name];

        if (isState(value)) {
          const stop = value.watch((current) => {
            this._mutate(() => {
              if (current) {
                element.classList.add(name);
              } else {
                element.classList.remove(name);
              }
            }); // NOTE: Not keyed; all update callbacks must run to apply all classes.
          });

          stopCallbacks.push(stop);
          classStopCallbacks.push(stop);
        } else if (value) {
          element.classList.add(name);
        }
      }
    }

    return function unapply() {
      for (const stop of classStopCallbacks) {
        stop();
        stopCallbacks.splice(stopCallbacks.indexOf(stop), 1);
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

/**
 * Attempts to convert `source` to the same type as `target`.
 * Returns `source` as-is if conversion is not possible.
 */
function toTypeOf<T>(target: T, source: unknown): T | unknown {
  const type = typeof target;

  if (type === "string") {
    return String(source);
  }

  if (type === "number") {
    return Number(source);
  }

  if (type === "boolean") {
    return Boolean(source);
  }

  return source;
}

// Attributes in this list will not be forwarded to the DOM node.
const privateProps = ["ref", "children", "class", "style", "data"];
