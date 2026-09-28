import { isArray, isFunction, isNumber, isObject, isString } from "../../../utils.js";
import { cleanupContext, Context, createContext, getNearestViewNode, mountContext } from "../../context.js";
import { Ref } from "../../ref.js";
import { type Getter, subscribe } from "../../signals.js";
import { DEBUG } from "../../symbols.js";
import { ConditionalTemplate, CSSTemplate, isConditionalTemplate, isCSSTemplate } from "../css.js";
import { flushPendingUpdates, scheduleUpdate } from "../scheduler.js";
import { MarkupNode, MountTarget } from "../types.js";
import type { MaybeGetter } from "../../../types.js";
import { addChild, camelToKebab, moveAfter, toMarkupNodes } from "../utils.js";

const IS_SVG = Symbol.for("$_IS_SVG");

const EMPTY_TEMPLATE_SET = new Set<CSSTemplate>();
const EMPTY_TEMPLATE_MAP = new Map<CSSTemplate, MaybeGetter<any>>();

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

  override mount(parent: MountTarget, after?: Node | null) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      this.#applyProps(this.#root, this.#props);

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

  override move(parent: MountTarget, after?: Node | null) {
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
      if (key === "ref" || key === "children") continue;

      const value = props[key];

      if (key === "style") {
        this.#applyStyles(element, value);
      } else if (key === "class" || key === "className") {
        this.#applyClasses(element, value);
      } else if (key === "for") {
        this.#attach(value, (current) => {
          if (current == null) {
            element.removeAttribute("for");
          } else {
            element.htmlFor = current;
          }
        });
      } else if (key.startsWith("prop:")) {
        // Keys starting with `prop:` are set as props.
        const _key = key.substring(5);
        this.#attach(value, (current) => {
          setProp(element, _key, current);
        });
      } else if (key.startsWith("attr:") || key[0] === ":") {
        // Keys starting with `attr:` or `:` are set as attributes.
        const _key = (key.startsWith("attr:") ? key.substring(5) : key.substring(1)).toLowerCase();
        this.#attach(value, (current) => {
          setAttribute(element, _key, current);
        });
      } else if (key.startsWith("on:")) {
        this.#attachListener(element, key.substring(3), value);
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
            setProp(element, key, current);
          });
        }
      } else {
        // Fall back to attributes.
        // SVG presentation attributes must use kebab-case (e.g. `fill-opacity`)
        // while JSX conventionally uses camelCase (`fillOpacity`). ARIA
        // attributes also require kebab-case (e.g. `aria-hidden`); any key
        // starting with "aria" followed by an uppercase letter is converted
        // by lowercasing the remainder and inserting a hyphen.
        let attrName = key;
        if (SVG_PRESENTATION_ATTRS.has(key)) {
          attrName = camelToKebab(key);
        } else if (/^aria[A-Z]/.test(key)) {
          attrName = "aria-" + key.slice(4).toLowerCase();
        }

        this.#attach(value, (current) => {
          setAttribute(element, attrName, current);
        });
      }
    }
  }

  #applyStyles(element: HTMLElement | SVGElement, styles: unknown) {
    const localUnsubs = new Set<() => void>();
    const prevStyles = new Map<string, string>();

    const apply = (current: unknown) => {
      this.#clearLocalSubs(localUnsubs);
      assertNotTemplate(current, "style", this.#context.name);
      if (current == null || current === false) {
        if (prevStyles.size > 0) {
          element.style.cssText = "";
          prevStyles.clear();
        }
        return;
      }

      const mapped = getStyleMap(current);
      const cssTextParts: string[] = [];
      const removed: string[] = [];

      for (const [name, { value, priority }] of Object.entries(mapped)) {
        if (isFunction(value)) {
          prevStyles.delete(name);
          const unsub = subscribe(value, (v) => {
            scheduleUpdate(() => {
              if (v) element.style.setProperty(name, formatValue(name, v), priority);
              else element.style.removeProperty(name);
            });
          });
          this.#unsubscribers.add(unsub);
          localUnsubs.add(unsub);
        } else if (value != null) {
          const formatted = formatValue(name, value);
          if (prevStyles.get(name) !== formatted) {
            cssTextParts.push(`${name}: ${formatted}${priority ? " !" + priority : ""}`);
          }
          prevStyles.set(name, formatted);
        }
      }

      for (const name of prevStyles.keys()) {
        if (!(name in mapped)) removed.push(name);
      }

      if (cssTextParts.length > 0) {
        element.style.cssText = cssTextParts.join("; ");
      }
      if (removed.length > 0) {
        for (const name of removed) element.style.removeProperty(name);
      }
      prevStyles.clear();
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

      const { templates: currentTemplates, conditions, remaining: processedValue } = this.#extractTemplates(current);

      this.#syncTemplates(currentTemplates, attachedTemplates, element);
      this.#applyConditions(conditions, currentTemplates, attachedTemplates, conditionSubs, element);

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
   * ConditionalTemplates.  Returns the templates to track, the conditions to
   * apply (one entry per ConditionalTemplate), and the remaining non-template
   * value (or `undefined` if nothing is left).
   *
   * Pure — no element side effects.  Both plain and conditional templates are
   * collected and deferred to `#syncTemplates` (which calls `.attach()` in
   * user-supplied order) and `#applyConditions` (which sets up the toggle/subscription
   * once the template is on the element).  Preserving this order is what lets
   * later templates override earlier ones in the stylesheet cascade.
   *
   * Both forms (top-level or nested inside an array) are handled identically.
   */
  #extractTemplates(
    current: unknown,
  ): { templates: Set<CSSTemplate>; conditions: Map<CSSTemplate, MaybeGetter<any>>; remaining: unknown } {
    if (!isArray(current) && !isCSSTemplate(current) && !isConditionalTemplate(current)) {
      return { templates: EMPTY_TEMPLATE_SET, conditions: EMPTY_TEMPLATE_MAP, remaining: current };
    }

    const templates = new Set<CSSTemplate>();
    const conditions = new Map<CSSTemplate, MaybeGetter<any>>();
    let remaining: unknown = current;

    const addConditional = (condTpl: ConditionalTemplate) => {
      templates.add(condTpl.template);
      conditions.set(condTpl.template, condTpl.condition);
    };

    if (isCSSTemplate(current)) {
      templates.add(current);
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

    return { templates, conditions, remaining };
  }

  /**
   * Synchronise the live set of attached CSSTemplates with what the current
   * value requires.  Must be called after `#extractTemplates` on every apply.
   *
   * 1. **Attach newcomers** — templates in `currentTemplates` that aren't yet
   *    in `attachedTemplates` get a one-time `.attach()` call, in the order the
   *    user supplied them.  This is what determines stylesheet insertion order
   *    and therefore CSS cascade for same-specificity rules.
   * 2. **Detach removed** — templates that were in `attachedTemplates` but are
   *    no longer in `currentTemplates` have their class name removed.  Any
   *    condition subscription is cleaned up separately by `#applyConditions`.
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
      }
    }
    attachedTemplates.clear();
    for (const tpl of currentTemplates) attachedTemplates.add(tpl);
  }

  /**
   * Apply the condition for each ConditionalTemplate collected by
   * `#extractTemplates`.  Called after `#syncTemplates` so the class is on the
   * element by the time we toggle it.
   *
   * 1. **Clean up removed** — unsubscribe any condition subscriptions whose
   *    template is no longer in `currentTemplates`, and remove them from
   *    `#unsubscribers` so they don't outlive the element.
   * 2. **Subscribe or toggle new** — for each `(template, condition)` pair in
   *    `conditions` whose template is still current:
   *    - Reactive getter condition: subscribe once (deduped via `conditionSubs`)
   *      and toggle the class on every change.
   *    - Static boolean condition: toggle the class immediately.  A no-op if
   *      the class is already in the desired state.
   *
   * Subscriptions are also registered on `#unsubscribers` for element-level
   * cleanup on unmount.
   */
  #applyConditions(
    conditions: Map<CSSTemplate, MaybeGetter<any>>,
    currentTemplates: Set<CSSTemplate>,
    attachedTemplates: Set<CSSTemplate>,
    conditionSubs: Map<CSSTemplate, () => void>,
    element: HTMLElement | SVGElement,
  ): void {
    for (const tpl of attachedTemplates) {
      if (!currentTemplates.has(tpl)) {
        const unsub = conditionSubs.get(tpl);
        if (unsub) {
          unsub();
          conditionSubs.delete(tpl);
          this.#unsubscribers.delete(unsub);
        }
      }
    }
    for (const [tpl, condition] of conditions) {
      if (!currentTemplates.has(tpl)) continue;
      if (isFunction(condition)) {
        if (!conditionSubs.has(tpl)) {
          const unsub = subscribe(condition, (val) => {
            scheduleUpdate(() => element.classList.toggle(tpl.className, Boolean(val)));
          });
          conditionSubs.set(tpl, unsub);
          this.#unsubscribers.add(unsub);
        }
      } else {
        element.classList.toggle(tpl.className, Boolean(condition));
      }
    }
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
  if (isString(classes)) {
    const result: Record<string, unknown> = {};
    for (const c of classes.split(" ")) if (c) result[c] = true;
    return result;
  }
  if (isCSSTemplate(classes)) return {};
  if (isArray(classes)) {
    const result: Record<string, unknown> = {};
    for (const item of classes) {
      if (item) {
        const m = getClassMap(item);
        for (const k in m) result[k] = m[k];
      }
    }
    return result;
  }
  if (isObject(classes)) return classes as Record<string, unknown>;
  return {};
}

/**
 * Parse styles into a single object.
 */
function getStyleMap(styles: unknown): Record<string, { value: unknown; priority?: string }> {
  if (isString(styles)) {
    const result: Record<string, { value: unknown; priority?: string }> = {};
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
      result[camelToKebab(key)] = { value: rawVal, priority };
    }
    return result;
  }
  if (isArray(styles)) {
    const result: Record<string, { value: unknown; priority?: string }> = {};
    for (const item of styles) {
      if (item) {
        const m = getStyleMap(item);
        for (const k in m) result[k] = m[k];
      }
    }
    return result;
  }
  if (isObject(styles)) {
    const result: Record<string, { value: unknown }> = {};
    for (const k in styles) {
      result[k.startsWith("--") ? k : camelToKebab(k)] = { value: styles[k] };
    }
    return result;
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
  if (value == null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, String(value));
  }
}

function setProp(element: Element, key: string, value: unknown) {
  if (value == null) {
    element.removeAttribute(key);
  } else {
    (element as any)[key] = value;
  }
}

function assertNotTemplate(value: unknown, prop: string, contextName: string): void {
  if (isCSSTemplate(value) || isConditionalTemplate(value)) {
    const message = `CSS templates are not supported on the "${prop}" prop. Pass them to "class" instead.\nComponent: ${contextName}\nSource: ${getSourceFrame()}`;
    throw new TypeError(message);
  }
  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (value[i] != null) assertNotTemplate(value[i], prop, contextName);
    }
  }
}

function getSourceFrame(): string {
  const stack = new Error().stack;
  if (!stack) return "(unknown)";
  const frames = stack.split("\n");
  for (let i = 1; i < frames.length; i++) {
    const line = frames[i];
    if (
      line.includes("element.ts") ||
      line.includes("element.js") ||
      line.includes("signals.") ||
      line.includes("markup/") ||
      line.includes("node:")
    ) {
      continue;
    }
    const match = line.match(/^\s*at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/);
    if (match) return `${match[1]}:${match[2]}:${match[3]}`;
  }
  return "(unknown)";
}
