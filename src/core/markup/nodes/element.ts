import { isArray, isFunction, isNumber, isObject, isString, omit } from "../../../utils.js";
import { cleanupContext, Context, createContext, getNearestViewNode, mountContext } from "../../context.js";
import { Ref } from "../../ref.js";
import { type Getter, subscribe } from "../../signals.js";
import { DEBUG } from "../../symbols.js";
import { ConditionalTemplate, CSSTemplate, isConditionalTemplate, isCSSTemplate } from "../css.js";
import { flushPendingUpdates, scheduleUpdate } from "../scheduler.js";
import { MarkupNode, MountTarget } from "../types.js";
import { addChild, camelToKebab, moveAfter, toMarkupNodes } from "../utils.js";

const IS_SVG = Symbol.for("$_IS_SVG");

// Properties in this list will not be processed by applyProps because they are already handled elsewhere.
const ignoredProps = ["ref", "children"];

// SVG presentation attributes that must use kebab-case as attribute names.
// When a matching camelCase key is encountered (e.g. `fillOpacity`), it is
// converted to its kebab-case equivalent (`fill-opacity`) before setAttribute.
const SVG_PRESENTATION_ATTRS = new Set([
  "clipPath",
  "clipRule",
  "colorInterpolation",
  "colorInterpolationFilters",
  "colorRendering",
  "dominantBaseline",
  "fillOpacity",
  "fillRule",
  "floodColor",
  "floodOpacity",
  "fontFamily",
  "fontSize",
  "fontSizeAdjust",
  "fontStretch",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "imageRendering",
  "letterSpacing",
  "lightingColor",
  "markerEnd",
  "markerMid",
  "markerStart",
  "maskType",
  "paintOrder",
  "pointerEvents",
  "shapeRendering",
  "stopColor",
  "stopOpacity",
  "strokeDasharray",
  "strokeDashoffset",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeMiterlimit",
  "strokeOpacity",
  "strokeWidth",
  "textAnchor",
  "textDecoration",
  "textOverflow",
  "textRendering",
  "transformOrigin",
  "unicodeBidi",
  "vectorEffect",
  "wordSpacing",
  "writingMode",
]);

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
      flushPendingUpdates();
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
    moveAfter(parent, this.#root, after);
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

  #attachListener(element: Element, eventName: string, value: unknown) {
    const listener = isFunction(value) ? value : (value as any)?.handleEvent;
    if (!isFunction(listener)) return;

    const options: AddEventListenerOptions | undefined =
      value && !isFunction(value)
        ? { capture: (value as any).capture, once: (value as any).once, passive: (value as any).passive }
        : undefined;

    element.addEventListener(eventName, listener, options);
    this.#unsubscribers.add(() => element.removeEventListener(eventName, listener, options));
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
      } else if (key.startsWith("prop:") || key[0] === ".") {
        // Keys starting with `prop:` or `.` are set as props.

        const _key = key.startsWith("prop:") ? key.substring(5) : key.substring(1);
        this.#attach(value, (current) => {
          element[_key] = current;
        });
      } else if (key.startsWith("attr:") || key[0] === ":") {
        // Keys starting with `attr:` or `:` are set as attributes.

        const _key = (key.startsWith("attr:") ? key.substring(5) : key.substring(1)).toLowerCase();
        this.#attach(value, (current) => {
          setAttribute(element, _key, current);
        });
      } else if (key.startsWith("on:")) {
        this.#attachListener(element, key.substring(3), value);
      } else if (key[0] === "@") {
        this.#attachListener(element, key.substring(1), value);
      } else if (key.startsWith("on")) {
        const eventName = key.slice(2).toLowerCase();
        if (eventName) this.#attachListener(element, eventName, value);
      } else if (key in element && !this.#context[IS_SVG]) {
        // Set as property if the element has one.

        if (typeof element[key] === "boolean") {
          this.#attach(value, (current) => {
            const isTrue = Boolean(current);
            element[key] = isTrue;
            if (isTrue) {
              element.setAttribute(key, "");
            } else {
              element.removeAttribute(key);
            }
          });
        } else {
          this.#attach(value, (current) => {
            element[key] = current;
          });
        }
      } else {
        // Fall back to attributes.
        // SVG presentation attributes must use kebab-case (e.g. `fill-opacity`)
        // while JSX conventionally uses camelCase (`fillOpacity`). Convert here
        // so both forms work.  `camelToKebab` is a no-op for already-kebab keys.
        const attrName = SVG_PRESENTATION_ATTRS.has(key) ? camelToKebab(key) : key;

        this.#attach(value, (current) => {
          setAttribute(element, attrName, current);
        });
      }
    }
  }

  #applyStyles(element: HTMLElement | SVGElement, styles: unknown) {
    const localUnsubs = new Set<() => void>();
    const attachedTemplates = new Set<CSSTemplate>();
    const conditionSubs = new Map<CSSTemplate, () => void>();

    const apply = (current: unknown) => {
      this.#clearLocalSubs(localUnsubs);
      element.style.cssText = "";

      const { templates: currentTemplates, remaining: processedValue } =
        this.#extractTemplates(current, element, attachedTemplates, conditionSubs);

      this.#syncTemplates(currentTemplates, attachedTemplates, conditionSubs, element);

      if (processedValue === undefined) return;
      current = processedValue;

      const mapped = getStyleMap(current);
      for (const [name, { value, priority }] of Object.entries(mapped)) {
        if (isFunction(value)) {
          const unsub = subscribe(value, (v) => {
            scheduleUpdate(() => {
              if (v) element.style.setProperty(name, formatValue(name, v), priority);
              else element.style.removeProperty(name);
            });
          });
          this.#unsubscribers.add(unsub);
          localUnsubs.add(unsub);
        } else if (value != null) {
          element.style.setProperty(name, formatValue(name, value), priority);
        }
      }
    };

    this.#attach(styles, (current) => apply(current));
  }

  #applyClasses(element: HTMLElement | SVGElement, classes: unknown) {
    const localUnsubs = new Set<() => void>();
    const staticClasses = new Set<string>();
    const attachedTemplates = new Set<CSSTemplate>();
    const conditionSubs = new Map<CSSTemplate, () => void>();

    const apply = (current: unknown) => {
      this.#clearLocalSubs(localUnsubs);

      const prevStaticClasses = new Set(staticClasses);
      staticClasses.clear();

      const { templates: currentTemplates, remaining: processedValue } =
        this.#extractTemplates(current, element, attachedTemplates, conditionSubs);

      this.#syncTemplates(currentTemplates, attachedTemplates, conditionSubs, element);

      if (processedValue === undefined) return;
      current = processedValue;

      const mapped = getClassMap(current);

      for (const [name, value] of Object.entries(mapped)) {
        if (name === "undefined") continue;

        if (isFunction(value)) {
          prevStaticClasses.delete(name);
          const unsub = subscribe(value, (isActive) => {
            scheduleUpdate(() => element.classList.toggle(name, !!isActive));
          });
          const wrapper = () => {
            element.classList.remove(name);
            unsub();
          };
          this.#unsubscribers.add(wrapper);
          localUnsubs.add(wrapper);
        } else if (value) {
          element.classList.add(name);
          staticClasses.add(name);
        }
      }

      for (const name of prevStaticClasses) {
        element.classList.remove(name);
      }
    };

    this.#attach(classes, (current) => apply(current));
  }

  /**
   * Scan an incoming style/class value and separate out any CSSTemplates and
   * ConditionalTemplates.  Returns the templates to track and the remaining
   * non-template value (or `undefined` if nothing is left).
   *
   * ## Plain CSSTemplates
   *
   * Collected for deferred attachment by `#syncTemplates`.  This avoids
   * re-attaching templates that are already live (tracked in
   * `attachedTemplates`).
   *
   * ## ConditionalTemplates (`css\`…\`.when(…)`)
   *
   * Attached eagerly — the template rules/bindings are set up once, then the
   * class name is toggled on/off by the condition.  If the condition is a
   * reactive getter, a subscription is created and tracked in `conditionSubs`
   * (also registered on `#unsubscribers` for element-level cleanup).  If it's
   * a static boolean, the toggle happens immediately.
   *
   * Both forms (top-level or nested inside an array) are handled identically.
   */
  #extractTemplates(
    current: unknown,
    element: HTMLElement | SVGElement,
    attachedTemplates: Set<CSSTemplate>,
    conditionSubs: Map<CSSTemplate, () => void>,
  ): { templates: Set<CSSTemplate>; remaining: unknown } {
    const templates = new Set<CSSTemplate>();
    let remaining: unknown = current;

    const addConditional = (condTpl: ConditionalTemplate) => {
      templates.add(condTpl.template);
      if (!attachedTemplates.has(condTpl.template)) {
        condTpl.template.attach(this.#context, element);
        attachedTemplates.add(condTpl.template);
      }
      if (isFunction(condTpl.condition)) {
        if (!conditionSubs.has(condTpl.template)) {
          const unsub = subscribe(condTpl.condition, (val) => {
            scheduleUpdate(() => element.classList.toggle(condTpl.template.className, Boolean(val)));
          });
          conditionSubs.set(condTpl.template, unsub);
          this.#unsubscribers.add(unsub);
        }
      } else {
        element.classList.toggle(condTpl.template.className, Boolean(condTpl.condition));
      }
    };

    if (isCSSTemplate(current)) {
      templates.add(current);
      if (!attachedTemplates.has(current)) {
        current.attach(this.#context, element);
        attachedTemplates.add(current);
      }
      remaining = undefined;
    } else if (isConditionalTemplate(current)) {
      addConditional(current);
      remaining = undefined;
    } else if (isArray(current)) {
      const items: unknown[] = [];
      for (const item of current) {
        if (isCSSTemplate(item)) {
          templates.add(item);
        } else if (isConditionalTemplate(item)) {
          addConditional(item);
        } else {
          items.push(item);
        }
      }
      remaining = items.length === 0 ? undefined : items.length === 1 ? items[0] : items;
    }

    return { templates, remaining };
  }

  /**
   * Synchronise the live set of attached CSSTemplates with what the current
   * value requires.  Must be called after `#extractTemplates` on every apply.
   *
   * 1. **Attach newcomers** — templates in `currentTemplates` that aren't yet
   *    in `attachedTemplates` get a one-time `.attach()` call.
   * 2. **Detach removed** — templates that were in `attachedTemplates` but are
   *    no longer in `currentTemplates` have their class name removed and their
   *    condition subscription (if any) cleaned up.
   * 3. **Sync state** — `attachedTemplates` is reset to match
   *    `currentTemplates`, ready for the next call.
   *
   * Because CSSTemplate attachment happens through the CSSOM (class-name based
   * rules), a detach is simply `element.classList.remove(tpl.className)` —
   * the CSSStyleRule stays in the sheet but is orphaned until garbage
   * collection reclaims the template reference.
   */
  #syncTemplates(
    currentTemplates: Set<CSSTemplate>,
    attachedTemplates: Set<CSSTemplate>,
    conditionSubs: Map<CSSTemplate, () => void>,
    element: HTMLElement | SVGElement,
  ): void {
    for (const tpl of currentTemplates) {
      if (!attachedTemplates.has(tpl)) {
        tpl.attach(this.#context, element);
      }
    }
    for (const tpl of attachedTemplates) {
      if (!currentTemplates.has(tpl)) {
        element.classList.remove(tpl.className);
        const unsub = conditionSubs.get(tpl);
        if (unsub) {
          unsub();
          conditionSubs.delete(tpl);
          this.#unsubscribers.delete(unsub);
        }
      }
    }
    attachedTemplates.clear();
    for (const tpl of currentTemplates) attachedTemplates.add(tpl);
  }

  #clearLocalSubs(localUnsubs: Set<() => void>) {
    localUnsubs.forEach((unsub) => {
      unsub();
      this.#unsubscribers.delete(unsub);
    });
    localUnsubs.clear();
  }
}

/**
 * Parse classes into a single object. Classes can be passed as a string, an object with class keys can boolean values, or an array with a mix of both.
 */
function getClassMap(classes: unknown): Record<string, unknown> {
  if (isString(classes)) return Object.fromEntries(classes.split(" ").map((c) => [c, true]));
  if (isCSSTemplate(classes)) return {};
  if (isArray(classes)) return Object.assign({}, ...classes.filter(Boolean).map(getClassMap));
  if (isObject(classes)) return classes as Record<string, unknown>;
  return {};
}

/**
 * Parse styles into a single object.
 */
function getStyleMap(styles: unknown): Record<string, { value: unknown; priority?: string }> {
  if (isString(styles)) {
    const entries: [string, { value: unknown; priority?: string }][] = [];
    for (const raw of styles.split(";")) {
      const line = raw.trim();
      if (!line) continue;
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      let rawVal = line.substring(colonIdx + 1).trim();
      let priority = "";
      const importantIdx = rawVal.toLowerCase().lastIndexOf("!important");
      if (importantIdx !== -1 && rawVal.slice(importantIdx + 10).trimEnd() === "") {
        rawVal = rawVal.slice(0, importantIdx).trimEnd();
        priority = "important";
      }
      entries.push([camelToKebab(key), { value: rawVal, priority }]);
    }
    return Object.fromEntries(entries);
  }
  if (isCSSTemplate(styles)) return {};
  if (isArray(styles)) return Object.assign({}, ...styles.filter(Boolean).map(getStyleMap));
  if (isObject(styles)) {
    return Object.fromEntries(
      Object.entries(styles).map(([k, v]) => [k.startsWith("--") ? k : camelToKebab(k), { value: v }]),
    );
  }
  return {};
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
  if (value != null) {
    element.setAttribute(name, String(value));
  } else {
    element.removeAttribute(name);
  }
}
