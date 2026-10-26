import { isArray, isFunction, isNumber, isObject, isString } from "../../../utils.js";
import { cleanupContext, createContext, getNearestViewNode, mountContext, type Context } from "../../context.js";
import type { Ref } from "../../ref.js";
import { type Getter, subscribe } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { DEBUG } from "../../symbols.js";
import { isConditionalTemplate, isCSSTemplate, type ConditionalTemplate, type CSSTemplate } from "../css-template.js";
import { flushPendingUpdates, runUpdate, scheduleUpdate } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
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

    // Add view name as a data attribute in debug mode.
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
      runSafely(() => child.unmount(true), { phase: "unmount", context: this.#context });
    }

    // Clear reactivity
    const unsubscribers = Array.from(this.#unsubscribers);
    this.#unsubscribers.clear();
    for (const unsubscribe of unsubscribers) {
      runSafely(unsubscribe, { phase: "unmount", context: this.#context });
    }

    cleanupContext(this.#context);

    // Clear ref
    if (this.#refCleanup) {
      const refCleanup = this.#refCleanup;
      this.#refCleanup = undefined;
      runSafely(refCleanup, { phase: "unmount", context: this.#context });
    }

    // Release memory
    this.#childNodes.length = 0;
  }

  override move(parent: MountTarget, after?: Node | null) {
    moveAfter(parent, this.#root, after);
  }

  /**
   * Subscribes to a reactive value and applies the latest value on each
   * update. The initial value is applied synchronously during mount, then
   * subsequent values share a stable update function so repeated changes
   * before a flush are coalesced into a single DOM write.
   */
  #subscribe<T>(getter: Getter<T>, callback: (value: T) => void, label: string) {
    let latest: T;
    let initialized = false;
    const meta = { label, context: this.#context };
    const run = () => callback(latest);

    return subscribe(
      getter,
      (current) => {
        latest = current;
        if (initialized) {
          scheduleUpdate(run, meta);
        } else {
          initialized = true;
          runUpdate(run, meta);
        }
      },
      { name: label, context: this.#context },
    );
  }

  #attach<T>(value: Getter<T> | T, callback: (value: T) => void, label: string) {
    if (isFunction<Getter<T>>(value)) {
      this.#unsubscribers.add(this.#subscribe(value, callback, label));
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
    const isSvg = Boolean(this.#context[IS_SVG]);

    for (const key in props) {
      if (key === "ref" || key === "children") continue;

      // Event props are listeners, not getters, so classify them before the
      // static/reactive split.
      if (key.startsWith("on:")) {
        this.#attachListener(element, key.substring(3), props[key]);
        continue;
      }

      if (key.startsWith("on")) {
        const eventName = key.slice(2).toLowerCase();
        if (eventName) this.#attachListener(element, eventName, props[key]);
        continue;
      }

      const value = props[key];

      if (isFunction(value)) {
        this.#applyDynamicProp(element, key, value as Getter<unknown>, isSvg);
      } else {
        this.#applyStaticProp(element, key, value, isSvg);
      }
    }
  }

  #applyStaticProp(element: any, key: string, value: unknown, isSvg: boolean) {
    if (key === "style") {
      if (isString(value)) {
        // Static CSS text can be assigned directly; the browser parser does
        // everything `getStyleMap` would otherwise do manually.
        element.style.cssText = value;
      } else if (hasReactiveValue(value)) {
        this.#applyStyles(element, value);
      } else {
        this.#applyStaticStyles(element, value);
      }
      return;
    }

    if (key === "class" || key === "className") {
      if (isString(value)) {
        // Use the attribute rather than `className`, which is an
        // SVGAnimatedString on SVG elements.
        element.setAttribute("class", value);
      } else if (isCSSTemplate(value)) {
        // Fast path for the common single-template case. Avoids building
        // the name/template/condition collections in #applyStaticClasses.
        value.attach(this.#context, element);
      } else if (hasReactiveClassValue(value)) {
        this.#applyClasses(element, value);
      } else {
        this.#applyStaticClasses(element, value);
      }
      return;
    }

    if (key === "for") {
      applyFor(element, value);
      return;
    }

    if (key.startsWith("prop:")) {
      setProp(element, key.substring(5), value);
      return;
    }

    if (key.startsWith("attr:")) {
      const name = key.substring(5).toLowerCase();
      setAttribute(element, name, value);
      return;
    }

    if (key in element && !isSvg) {
      // Set as property if the element has one.
      if (typeof element[key] === "boolean") {
        applyBooleanProperty(element, key, value);
      } else {
        setProp(element, key, value);
      }
      return;
    }

    setAttribute(element, normalizeAttributeName(key), value);
  }

  #applyDynamicProp(element: any, key: string, getter: Getter<unknown>, isSvg: boolean) {
    if (key === "style") {
      this.#applyStyles(element, getter);
      return;
    }

    if (key === "class" || key === "className") {
      this.#applyClasses(element, getter);
      return;
    }

    if (key === "for") {
      this.#subscribe(getter, (value) => applyFor(element, value), "element:for");
      return;
    }

    if (key.startsWith("prop:")) {
      const name = key.substring(5);
      this.#subscribe(getter, (value) => setProp(element, name, value), `element:${key}`);
      return;
    }

    if (key.startsWith("attr:")) {
      const name = key.substring(5).toLowerCase();
      this.#subscribe(getter, (value) => setAttribute(element, name, value), `element:${key}`);
      return;
    }

    if (key in element && !isSvg) {
      // Set as property if the element has one.
      if (typeof element[key] === "boolean") {
        this.#subscribe(getter, (value) => applyBooleanProperty(element, key, value), `element:${key}`);
      } else {
        this.#subscribe(getter, (value) => setProp(element, key, value), `element:${key}`);
      }
      return;
    }

    const name = normalizeAttributeName(key);
    this.#subscribe(getter, (value) => setAttribute(element, name, value), `element:${key}`);
  }

  #applyStaticStyles(element: HTMLElement | SVGElement, styles: unknown) {
    assertNotTemplate(styles, "style", this.#context.name);

    if (isObject(styles)) {
      for (const key in styles) {
        const value = (styles as Record<string, unknown>)[key];
        if (value == null) continue;

        const name = key.startsWith("--") ? key : camelToKebab(key);
        setStyleValue(element, name, getStyleProperty(element, key), value);
      }
      return;
    }

    const mapped = getStyleMap(styles);
    for (const [name, { value, priority }] of Object.entries(mapped)) {
      if (value != null) {
        setStyleValue(element, name, undefined, value, priority);
      }
    }
  }

  #applyStaticClasses(element: HTMLElement | SVGElement, classes: unknown) {
    const names = new Set<string>();
    const templates = new Set<CSSTemplate>();
    const conditions = new Map<CSSTemplate, boolean>();
    collectStaticClasses(classes, names, templates, conditions);

    if (names.size > 0) element.setAttribute("class", Array.from(names).join(" "));

    for (const tpl of templates) tpl.attach(this.#context, element);
    for (const [tpl, active] of conditions) {
      element.classList.toggle(tpl.className, active);
    }
  }

  #applyStyles(element: HTMLElement | SVGElement, styles: unknown) {
    const localUnsubs = new Set<() => void>();
    const appliedNames = new Set<string>();

    const apply = (current: unknown) => {
      this.#clearLocalSubs(localUnsubs);
      assertNotTemplate(current, "style", this.#context.name);

      const nextNames = new Set<string>();
      const reactive: { name: string; value: Getter<unknown>; priority?: string; property?: string }[] = [];

      const add = (name: string, value: unknown, priority?: string, property?: string) => {
        if (isFunction(value)) {
          reactive.push({ name, value: value as Getter<unknown>, priority, property });
        } else if (value != null) {
          setStyleValue(element, name, property, value, priority);
          nextNames.add(name);
        }
      };

      if (current != null && current !== false) {
        if (isObject(current)) {
          // Fast path for plain style objects: no intermediate normalized map,
          // no second pass, and no `cssText` rewrite that would wipe custom
          // properties set by CSS templates or other inline styles.
          for (const key in current) {
            const name = key.startsWith("--") ? key : camelToKebab(key);
            add(name, (current as Record<string, unknown>)[key], undefined, getStyleProperty(element, key));
          }
        } else {
          const mapped = getStyleMap(current);
          for (const [name, { value, priority }] of Object.entries(mapped)) {
            add(name, value, priority);
          }
        }
      }

      for (const { name } of reactive) {
        nextNames.add(name);
      }

      // Remove properties that were managed by the previous style value but
      // are no longer present.
      for (const name of appliedNames) {
        if (!nextNames.has(name)) element.style.removeProperty(name);
      }
      appliedNames.clear();
      for (const name of nextNames) appliedNames.add(name);

      for (const { name, value, priority, property } of reactive) {
        const unsub = this.#subscribe(
          value,
          (v) => {
            if (v) setStyleValue(element, name, property, v, priority);
            else element.style.removeProperty(name);
          },
          `element:style:${name}`,
        );
        this.#unsubscribers.add(unsub);
        localUnsubs.add(unsub);
      }
    };

    this.#attach(styles, (current) => apply(current), "element:style");
  }

  #applyClasses(element: HTMLElement | SVGElement, classes: unknown) {
    const localUnsubs = new Set<() => void>();
    const staticClasses = new Set<string>();
    const attachedTemplates = new Set<CSSTemplate>();
    const conditionSubs = new Map<CSSTemplate, () => void>();

    const apply = (current: unknown) => {
      this.#clearLocalSubs(localUnsubs);

      const { templates: currentTemplates, conditions, remaining: processedValue } = this.#extractTemplates(current);

      this.#syncTemplates(currentTemplates, attachedTemplates, element);
      this.#applyConditions(conditions, currentTemplates, attachedTemplates, conditionSubs, element);

      if (processedValue === undefined) {
        const prevStaticClasses = new Set(staticClasses);
        staticClasses.clear();
        for (const name of prevStaticClasses) {
          element.classList.remove(name);
        }
        return;
      }

      const canReplaceClassAttribute =
        currentTemplates.size === 0 && attachedTemplates.size === 0 && conditionSubs.size === 0;

      // Fast path when this value owns the entire class attribute: no
      // templates, conditions, or reactive entries. Replacing the attribute
      // avoids DOMTokenList add/remove churn on every update.
      if (canReplaceClassAttribute && isString(processedValue)) {
        if (processedValue !== "undefined" && processedValue.indexOf(" ") === -1) {
          element.setAttribute("class", processedValue);
          staticClasses.clear();
          if (processedValue) staticClasses.add(processedValue);
          return;
        }

        const names = new Set<string>();
        for (const name of processedValue.split(" ")) {
          if (name && name !== "undefined") names.add(name);
        }
        element.setAttribute("class", Array.from(names).join(" "));
        staticClasses.clear();
        for (const name of names) staticClasses.add(name);
        return;
      }

      const mapped = getClassMap(processedValue);
      const names: string[] = [];
      const reactive: { name: string; value: Getter<unknown> }[] = [];

      for (const [name, value] of Object.entries(mapped)) {
        if (name === "undefined") continue;

        if (isFunction(value)) {
          reactive.push({ name, value: value as Getter<unknown> });
        } else if (value) {
          names.push(name);
        }
      }

      if (canReplaceClassAttribute && reactive.length === 0) {
        element.setAttribute("class", names.join(" "));
        staticClasses.clear();
        for (const name of names) staticClasses.add(name);
        return;
      }

      const prevStaticClasses = new Set(staticClasses);
      staticClasses.clear();
      for (const name of names) staticClasses.add(name);

      // A reactive class is applied by its subscription below and must not be
      // removed as if it were a stale static class.
      for (const { name } of reactive) {
        prevStaticClasses.delete(name);
      }

      for (const name of prevStaticClasses) {
        if (!staticClasses.has(name)) element.classList.remove(name);
      }

      for (const name of names) {
        element.classList.add(name);
      }

      // Subscribe after static classes are applied so a reactive `false`
      // always wins when a name appears in both forms.
      for (const { name, value } of reactive) {
        const unsub = this.#subscribe(
          value,
          (isActive) => element.classList.toggle(name, !!isActive),
          `element:class:${name}`,
        );
        const wrapper = () => {
          element.classList.remove(name);
          unsub();
        };
        this.#unsubscribers.add(wrapper);
        localUnsubs.add(wrapper);
      }
    };

    this.#attach(classes, (current) => apply(current), "element:class");
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
  #extractTemplates(current: unknown): {
    templates: Set<CSSTemplate>;
    conditions: Map<CSSTemplate, MaybeGetter<any>>;
    remaining: unknown;
  } {
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
          const unsub = this.#subscribe(
            condition,
            (val) => element.classList.toggle(tpl.className, Boolean(val)),
            `element:class:${tpl.className}`,
          );
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

function hasReactiveClassValue(value: unknown): boolean {
  if (isFunction(value)) return true;
  if (isConditionalTemplate(value)) return isFunction(value.condition);
  if (isCSSTemplate(value)) return false;

  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (hasReactiveClassValue(value[i])) return true;
    }
    return false;
  }

  if (isObject(value)) {
    for (const key in value) {
      if (isFunction((value as Record<string, unknown>)[key])) return true;
    }
  }

  return false;
}

function collectStaticClasses(
  value: unknown,
  names: Set<string>,
  templates: Set<CSSTemplate>,
  conditions: Map<CSSTemplate, boolean>,
): void {
  if (value == null || value === false) return;

  if (isCSSTemplate(value)) {
    templates.add(value);
    return;
  }

  if (isConditionalTemplate(value)) {
    templates.add(value.template);
    conditions.set(value.template, Boolean(value.condition));
    return;
  }

  if (isString(value)) {
    for (const name of value.split(" ")) {
      if (name && name !== "undefined") names.add(name);
    }
    return;
  }

  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectStaticClasses(value[i], names, templates, conditions);
    }
    return;
  }

  if (isObject(value)) {
    for (const key in value) {
      if (key === "undefined") continue;
      if ((value as Record<string, unknown>)[key]) names.add(key);
    }
  }
}

function hasReactiveValue(value: unknown): boolean {
  if (isFunction(value) || isCSSTemplate(value) || isConditionalTemplate(value)) return true;

  if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (hasReactiveValue(value[i])) return true;
    }
    return false;
  }

  if (isObject(value)) {
    for (const key in value) {
      if (isFunction((value as Record<string, unknown>)[key])) return true;
    }
  }

  return false;
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

function applyFor(element: any, value: unknown) {
  if (value == null) {
    element.removeAttribute("for");
  } else {
    element.htmlFor = value;
  }
}

function applyBooleanProperty(element: any, key: string, value: unknown) {
  const isTrue = Boolean(value);
  element[key] = isTrue;
  if (isTrue) {
    element.setAttribute(key, "");
  } else {
    element.removeAttribute(key);
  }
}

function normalizeAttributeName(key: string): string {
  // SVG presentation attributes must use kebab-case (e.g. `fill-opacity`)
  // while JSX conventionally uses camelCase (`fillOpacity`). ARIA attributes
  // also require kebab-case (e.g. `aria-hidden`); any key starting with "aria"
  // followed by an uppercase letter is converted by lowercasing the remainder
  // and inserting a hyphen.
  if (SVG_PRESENTATION_ATTRS.has(key)) {
    return camelToKebab(key);
  } else if (/^aria[A-Z]/.test(key)) {
    return "aria-" + key.slice(4).toLowerCase();
  } else {
    return key;
  }
}

function getStyleProperty(element: HTMLElement | SVGElement, key: string): string | undefined {
  if (key === "cssText" || key.startsWith("--") || key.indexOf("-") !== -1) return undefined;
  return typeof (element.style as any)[key] === "string" ? key : undefined;
}

function setStyleValue(
  element: HTMLElement | SVGElement,
  name: string,
  property: string | undefined,
  value: unknown,
  priority?: string,
): void {
  const formatted = formatValue(name, value);
  if (property !== undefined && !priority) {
    (element.style as any)[property] = formatted;
  } else {
    element.style.setProperty(name, formatted, priority);
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
