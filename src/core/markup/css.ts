import { isFunction } from "../../utils";
import type { MaybeGetter } from "../../types.js";
import { onCleanup, onEffect, type Context } from "../context";
import type { Getter } from "../signals";
import {
  IS_CONDITIONAL_TEMPLATE,
  IS_CSS_TEMPLATE,
  IS_STYLED_VIEW,
  isConditionalTemplate,
  isCSSTemplate,
  isStyledTemplate,
  type ConditionalTemplate,
  type CSSTemplate,
  type StyledTemplate,
} from "./css-template.js";

export { isConditionalTemplate, isCSSTemplate, isStyledTemplate };
export type { ConditionalTemplate, CSSTemplate, StyledTemplate };

/*============================*\
||           Types            ||
\*============================*/

export type CoreCSSSyntax =
  | "*"
  | "<length>"
  | "<percentage>"
  | "<length-percentage>"
  | "<color>"
  | "<image>"
  | "<url>"
  | "<integer>"
  | "<number>"
  | "<angle>"
  | "<time>"
  | "<resolution>"
  | "<transform-function>"
  | "<transform-list>"
  | "<custom-ident>";

export type CSSSyntaxDescriptor = CoreCSSSyntax | (string & {});

type SyntaxValueType<T extends CSSSyntaxDescriptor> = T extends "<number>" | "<integer>"
  ? number
  : T extends "<color>" | "<angle>" | "<length>" | "<percentage>"
    ? string
    : string | number;

/**
 * A Houdini `@property` config object passed as a template interpolation.
 * Registers a typed custom property with the browser and binds its value
 * from the given getter (or static `value`).
 *
 * ```ts
 * ${{ syntax: "<color>", value: () => hue(), initialValue: "red", inherits: false }}
 * ```
 */
export type PropertyConfig<Syntax extends CSSSyntaxDescriptor> = {
  syntax: Syntax;
  value: Getter<InterpolationValue> | InterpolationValue;
  initialValue?: SyntaxValueType<Syntax>;
  inherits?: boolean;
};

export type InterpolationValue = string | number | false | null | undefined;

export type Interpolation<Props = {}> =
  | InterpolationValue
  | Getter<InterpolationValue>
  | PropertyConfig<any>
  | Keyframes
  | CSSTemplate
  | StyledTemplate;

/**
 * A `@keyframes` rule registered under a generated name. Interpolate it into a
 * `css` template (or use `name`) wherever an animation name is expected.
 */
export interface Keyframes {
  readonly name: string;
  toString(): string;
}

/**
 * A value bound to a CSS variable name.
 */
export type CSSTemplateBinding = {
  index: number;
  varName: string;
  initialValue: any;
  read: (interpolations: any[]) => any;
};

/*============================*\
||           Helpers          ||
\*============================*/

function getTemplateClassName(value: any): string | undefined {
  if (isCSSTemplate(value)) return value.className;
  if (isStyledTemplate(value)) return value[IS_STYLED_VIEW].className;
  return undefined;
}

/**
 * A function interpolation is only reactive when it is a plain getter. Styled
 * views are callable but represent a static class-name selector.
 */
function isReactiveFunction(value: any): value is Getter<InterpolationValue> {
  return isFunction(value) && !isStyledTemplate(value);
}

// Marks the start of each interpolation slot in a template key. Bindings are
// read from `interpolations` by index, so the key must encode every slot's
// position and kind; otherwise templates with different slot layouts (e.g.
// `margin: ${a}` and `margin: ${a} ${b}`) could share a cached shape.
const SLOT = "\u0000";

/**
 * Builds a string that uniquely identifies the CSS a template produces and the
 * layout of its interpolation slots. Equal keys can safely share a shape.
 */
function templateKey(strings: TemplateStringsArray, interpolations: any[]): string {
  let key = "";

  strings.forEach((str, i) => {
    key += str;

    if (i < interpolations.length) {
      let expr = interpolations[i];

      const className = getTemplateClassName(expr);
      if (className != null) {
        // Nested CSSTemplate: include its className so equivalent templates
        // dedup (e.g. `${base} { ... }` vs `${baseCopy} { ... }`).
        key += `${SLOT}.${className}`;
      } else if (typeof expr === "function") {
        // Reactive getter: the function reference is not part of the rendered
        // CSS (it becomes a `var(--…)` binding), so only its slot is recorded.
        // This preserves dedup across `css\`color: ${hue};\`` defined in two places.
        key += `${SLOT}f`;
      } else if (isPropertyConfig(expr)) {
        // PropertyConfig: the static-defining fields are `syntax` and
        // `initialValue` (the `value` getter becomes a CSS var binding).
        key += `${SLOT}~${expr.syntax}|${String(expr.initialValue ?? "")}`;
      } else {
        // Static primitive (string/number/null/undefined) or other value:
        // include its stringification so `css\`font-size: ${size};\`` and
        // `css\`font-size: 14px;\`` produce distinct classNames when the
        // static parts differ only in interpolation values.
        key += `${SLOT}s${String(expr)}`;
      }
    }
  });

  return key.trim();
}

const namesByKey = new Map<string, string>();
const claimedNames = new Set<string>();

/**
 * Returns a stable `<prefix>-<hash>` name for a key. Equal keys share a name
 * only within the same `scope`. The short hash can collide for different keys,
 * so a colliding key gets a numbered suffix instead of reusing another key's name.
 */
function nameForKey(prefix: string, key: string, scope = prefix): string {
  const fullKey = `${scope}${SLOT}${key}`;
  let name = namesByKey.get(fullKey);
  if (name !== undefined) return name;

  // Hash the scope too when it isn't the default, so scoped names rarely need a suffix.
  const hashed = scope === prefix ? key : fullKey;
  let hash = 0;
  for (let i = 0; i < hashed.length; i++) {
    hash = (Math.imul(31, hash) + hashed.charCodeAt(i)) | 0;
  }

  const base = `${prefix}-${Math.abs(hash).toString(36)}`;
  name = base;
  for (let n = 1; claimedNames.has(name); n++) {
    name = `${base}-${n}`;
  }

  claimedNames.add(name);
  namesByKey.set(fullKey, name);
  return name;
}

function isPropertyConfig(value: any): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "syntax" in value && "value" in value;
}

const noop = () => {};

/**
 * Adds `className` to `element` (reactively when `condition` is a getter).
 * Returns `null` when the class is not applied at all, otherwise a function
 * that stops any condition tracking.
 */
function attachClass(
  c: Context,
  className: string,
  element: HTMLElement | SVGElement,
  condition?: MaybeGetter<any>,
): (() => void) | null {
  if (isFunction(condition)) {
    return onEffect(c, () => {
      element.classList.toggle(className, Boolean(condition()));
    });
  } else if (Boolean(condition)) {
    element.classList.add(className);
    return noop;
  } else {
    return null;
  }
}

const nonNestableAtRules = new Set([
  "keyframes",
  "font-face",
  "property",
  "counter-style",
  "page",
  "font-feature-values",
]);

// Conditional group rules that may contain non-nestable at-rules. Those keep
// their conditions when extracted (`@media x { @keyframes … }`).
const groupingAtRules = new Set(["media", "supports", "container", "layer"]);

/** Returns the index just past the comment or string starting at `i`, or `i` if there is none. */
function skipCommentOrString(css: string, i: number): number {
  const c = css[i];
  if (c === "/" && css[i + 1] === "*") {
    const end = css.indexOf("*/", i + 2);
    return end === -1 ? css.length : end + 2;
  }
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < css.length && css[j] !== c) j += css[j] === "\\" ? 2 : 1;
    return Math.min(j + 1, css.length);
  }
  return i;
}

/** Returns the index just past the `}` matching the `{` at `open`. */
function findBlockEnd(css: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < css.length) {
    const skipped = skipCommentOrString(css, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i + 1;
    i++;
  }
  return css.length;
}

/**
 * Scans CSS and extracts at-rules that cannot be nested inside a style rule
 * (@keyframes, @font-face, @property, @counter-style, @page, @font-feature-values,
 * including vendor-prefixed forms like @-webkit-keyframes). These are returned
 * separately so they can be inserted as top-level rules, while the remaining
 * CSS is wrapped in the class selector and inserted as a single style rule
 * (relying on native CSS Nesting for @media etc.). An extracted rule nested in
 * @media/@supports/@container/@layer is wrapped in those same conditions.
 * Strings and comments are skipped, so `content: "}"` or `"@page"` are safe.
 */
function extractNonNestableAtRules(css: string): { cleanCss: string; extracted: string[] } {
  const extracted: string[] = [];

  const process = (text: string, conditions: string[]): string => {
    let result = "";
    let i = 0;

    while (i < text.length) {
      const skipped = skipCommentOrString(text, i);
      if (skipped !== i) {
        result += text.slice(i, skipped);
        i = skipped;
        continue;
      }

      if (text[i] !== "@") {
        result += text[i++];
        continue;
      }

      const start = i;
      let j = i + 1;
      while (j < text.length && /[\w-]/.test(text[j])) j++;
      const name = text
        .slice(i + 1, j)
        .toLowerCase()
        .replace(/^-[a-z]+-/, "");
      const isNonNestable = nonNestableAtRules.has(name);

      if (isNonNestable || groupingAtRules.has(name)) {
        // Find the end of the prelude: a block `{` or a statement `;`.
        let k = j;
        while (k < text.length && text[k] !== "{" && text[k] !== ";") {
          const next = skipCommentOrString(text, k);
          k = next !== k ? next : k + 1;
        }

        if (text[k] === "{") {
          const end = findBlockEnd(text, k);

          if (isNonNestable) {
            let rule = text.slice(start, end);
            for (let n = conditions.length - 1; n >= 0; n--) rule = `${conditions[n]} { ${rule} }`;
            extracted.push(rule);
          } else {
            const prelude = text.slice(start, k);
            const bodyEnd = text[end - 1] === "}" ? end - 1 : end; // unterminated block
            const body = process(text.slice(k + 1, bodyEnd), [...conditions, prelude.trim()]);
            result += `${prelude}{${body}}`;
          }

          i = end;
          continue;
        }
      }

      result += text.slice(start, j);
      i = j;
    }

    return result;
  };

  return { cleanCss: process(css, []), extracted };
}

/*============================*\
||          Registry          ||
\*============================*/

/** Inserts the rules for a class at `index` and returns them. */
function insertRules(className: string, rawCss: string, sheet: CSSStyleSheet, index: number): CSSRule[] {
  const { cleanCss, extracted } = extractNonNestableAtRules(rawCss);
  if (cleanCss.trim()) extracted.push(`.${className}{${cleanCss}}`);

  const inserted: CSSRule[] = [];
  for (const rule of extracted) {
    try {
      sheet.insertRule(rule, index);
      inserted.push(sheet.cssRules[index]);
      index++;
    } catch (e) {}
  }
  return inserted;
}

/**
 * Replaces a class's `rules` with ones built from `rawCss`, at the position of the
 * first old rule so the class keeps its place in the cascade. Returns the new rules.
 * A function rather than a registry method so production builds can drop it with
 * the rest of the HMR code.
 */
function replaceRules(className: string, rawCss: string, rules: CSSRule[], sheet: CSSStyleSheet): CSSRule[] {
  let index = sheet.cssRules.length;
  for (const rule of rules) {
    const i = Array.prototype.indexOf.call(sheet.cssRules, rule);
    if (i === -1) continue;
    sheet.deleteRule(i);
    index = Math.min(index, i);
  }
  return insertRules(className, rawCss, sheet, index);
}

class StyleRegistry {
  // Styled component bases come before plain `css` rules in the cascade, so a
  // `css` class passed to a styled component always overrides its base styles.
  styledSheet = new CSSStyleSheet();
  sheet = new CSSStyleSheet();
  classes = new Set<string>();
  properties = new Set<string>();

  constructor() {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.styledSheet, this.sheet];
    if (typeof window !== "undefined") {
      const dbg = ((window as any).__dollaDbg ??= {});
      dbg.registry = this;
    }
  }

  /** Inserts a class's rules and returns them, or nothing if the class is already registered. */
  insertClass(className: string, rawCss: string, sheet = this.sheet): CSSRule[] {
    if (this.classes.has(className)) return [];
    this.classes.add(className);
    return insertRules(className, rawCss, sheet, sheet.cssRules.length);
  }

  insertKeyframes(name: string, body: string): void {
    if (this.classes.has(name)) return;
    try {
      this.sheet.insertRule(`@keyframes ${name}{${body}}`, this.sheet.cssRules.length);
    } catch (e) {}
    this.classes.add(name);
  }

  addProperty(name: string, syntax: string, initialValue: any, inherits: boolean) {
    if (this.properties.has(name) || syntax === "*") return;

    try {
      CSS.registerProperty({
        name,
        syntax,
        inherits,
        initialValue,
      });
      this.properties.add(name);
    } catch (e) {
      console.warn(`[Dolla] Failed to register @property ${name}:`, e);
    }
  }
}

const registry = new StyleRegistry();

/*============================*\
||     Template builder       ||
\*============================*/

/**
 * Walks the template strings/interpolations and produces the final CSS string
 * (with `var(--className-N)` placeholders for function interpolations) plus
 * the list of reactive bindings that need per-instance wiring.
 *
 * Pure: no context, no element, no side effects beyond optional Houdini
 * `@property` registration (deduped by the registry). Used by `attach` for
 * per-element binding.
 */
function buildStyles(
  className: string,
  strings: TemplateStringsArray,
  interpolations: any[],
): { styles: string; bindings: CSSTemplateBinding[] } {
  const bindings: CSSTemplateBinding[] = [];
  let styles = "";

  strings.forEach((str, i) => {
    styles += str;

    if (i < interpolations.length) {
      let expr = interpolations[i];

      const classNameFromTpl = getTemplateClassName(expr);
      if (classNameFromTpl != null) {
        styles += `.${classNameFromTpl}`;
        return;
      }

      // PropertyConfig: a Houdini @property descriptor. The runtime
      // registers a typed custom property and binds its value from
      // the `value` (getter or static).
      if (typeof expr === "object" && expr !== null && !Array.isArray(expr) && "syntax" in expr && "value" in expr) {
        const config = expr as {
          syntax: string;
          value: (() => any) | any;
          initialValue?: any;
          inherits?: boolean;
        };
        const { syntax, initialValue, inherits } = config;
        const varName = `--${className}-${i}`;

        if (initialValue != null) {
          styles += `var(${varName}, ${initialValue})`;
          if (syntax !== "*") {
            registry.addProperty(varName, syntax, initialValue, inherits ?? false);
          }
        } else {
          styles += `var(${varName})`;
        }

        bindings.push({
          index: i,
          varName,
          initialValue,
          read: (interpolations) => {
            const value = interpolations[i].value;
            return typeof value === "function" ? value() : value;
          },
        });
      } else if (typeof expr === "function") {
        const varName = `--${className}-${i}`;
        styles += `var(${varName})`;
        bindings.push({
          index: i,
          varName,
          initialValue: null,
          read: (interpolations) => interpolations[i](),
        });
      } else if (expr != null && expr !== false) {
        // `null`, `undefined` and `false` (e.g. `${cond && "..."}`) emit nothing.
        styles += expr;
      }
    }
  });

  return { styles, bindings };
}

type TemplateShape = {
  className: string;
  styles: string;
  bindings: CSSTemplateBinding[];
  registered: boolean;
  styled: boolean;
};

// Template literals keep the same `strings` object per call site, so these
// caches let inline `css` calls in views reuse work across mounts.
const staticTemplates = new Map<string, CSSTemplate>();
const shapesByClassName = new Map<string, TemplateShape>();

// Stylesheet rules are never removed, so a call site that bakes a different
// static value into every template grows the stylesheet without limit.
const PER_VALUE_WARNING_THRESHOLD = 50;
const classCountsByStrings = new WeakMap<TemplateStringsArray, number>();

function countNewClass(strings: TemplateStringsArray): void {
  const count = (classCountsByStrings.get(strings) ?? 0) + 1;
  classCountsByStrings.set(strings, count);
  if (count !== PER_VALUE_WARNING_THRESHOLD) return;

  const source = strings.join("${…}").replace(/\s+/g, " ").trim();
  console.warn(
    `[dolla] css\`${source.length > 80 ? source.slice(0, 77) + "..." : source}\` has created ` +
      `${count} classes from different static values. Each one adds a stylesheet rule that is never removed. ` +
      `Pass a getter instead (\${() => value}) to set the value as a CSS variable.`,
  );
}

/**
 * Sets the custom properties of a template's reactive values on `element` and keeps them
 * updated. Returns a function that stops updating them and removes them.
 */
function bindValues(
  c: Context,
  element: HTMLElement | SVGElement,
  bindings: CSSTemplateBinding[],
  interpolations: any[],
): () => void {
  if (bindings.length === 0) return noop;

  const stop = onEffect(c, () => {
    for (const binding of bindings) {
      const value = binding.read(interpolations);

      if (value === null || value === undefined || value === binding.initialValue) {
        element.style.removeProperty(binding.varName);
      } else {
        element.style.setProperty(binding.varName, value);
      }
    }
  });

  return () => {
    stop();
    for (const binding of bindings) {
      element.style.removeProperty(binding.varName);
    }
  };
}

class CSSFactoryTemplate implements CSSTemplate {
  readonly [IS_CSS_TEMPLATE] = true;
  readonly className: string;

  #shape: TemplateShape;
  #interpolations: any[];

  constructor(shape: TemplateShape, interpolations: any[]) {
    this.className = shape.className;
    this.#shape = shape;
    this.#interpolations = interpolations;
  }

  toString(): string {
    return this.className;
  }

  attach(c: Context, element: HTMLElement | SVGElement, condition: MaybeGetter<any> = true): () => void {
    const stopCondition = attachClass(c, this.className, element, condition);
    if (!stopCondition) return noop;

    const shape = this.#shape;

    if (!shape.registered) {
      registry.insertClass(this.className, shape.styles, shape.styled ? registry.styledSheet : registry.sheet);
      shape.registered = true;
    }

    if (shape.bindings.length === 0) return stopCondition;

    const stopBindings = bindValues(c, element, shape.bindings, this.#interpolations);

    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      stopCondition();
      stopBindings();
    };

    onCleanup(c, detach);
    return detach;
  }

  when(condition: MaybeGetter<any>): ConditionalTemplate {
    return { [IS_CONDITIONAL_TEMPLATE]: true, template: this, condition };
  }
}

// Each styled call site gets its own class names (see `styledTemplate`).
const styledSites = new WeakMap<TemplateStringsArray, number>();
let nextStyledSite = 0;

function createTemplate(strings: TemplateStringsArray, interpolations: any[], styled = false): CSSTemplate {
  let shape: TemplateShape | undefined;
  let className: string;
  let isStatic = false;

  {
    let scope: string | undefined;
    if (styled) {
      let site = styledSites.get(strings);
      if (site === undefined) styledSites.set(strings, (site = nextStyledSite++));
      scope = `styled:${site}`;
    }
    className = nameForKey("css", templateKey(strings, interpolations), scope);
    isStatic = interpolations.every((expr) => !isReactiveFunction(expr) && !isPropertyConfig(expr));

    if (isStatic) {
      const cached = staticTemplates.get(className);
      if (cached) return cached;
    }

    shape = shapesByClassName.get(className);

    if (!shape) {
      countNewClass(strings);
      const built = buildStyles(className, strings, interpolations);
      shape = {
        className,
        styles: built.styles,
        bindings: built.bindings,
        registered: false,
        styled,
      };
      shapesByClassName.set(className, shape);
    }
  }

  const template = new CSSFactoryTemplate(shape, interpolations);

  if (isStatic) {
    staticTemplates.set(className, template);
  }

  return template;
}

/*============================*\
||        Hot templates       ||
\*============================*/

type HotAttachment = {
  c: Context;
  element: HTMLElement | SVGElement;
  stopBindings: () => void;
};

/**
 * A module-level `css` template that keeps its identity and class name across hot reloads.
 * When its module reloads, its rule is replaced in the stylesheet and its reactive values
 * are rebound on attached elements, so elements restyle without re-rendering their views.
 */
class HotTemplate implements CSSTemplate {
  readonly [IS_CSS_TEMPLATE] = true;
  readonly className: string;

  #styles = "";
  #bindings: CSSTemplateBinding[] = [];
  #interpolations: any[] = [];
  /** The rules in the stylesheet, once the template has been attached. */
  #rules: CSSRule[] | undefined;
  #attachments = new Set<HotAttachment>();

  constructor(className: string) {
    this.className = className;
  }

  update(strings: TemplateStringsArray, interpolations: any[]): void {
    const { styles, bindings } = buildStyles(this.className, strings, interpolations);
    this.#styles = styles;
    this.#bindings = bindings;
    this.#interpolations = interpolations;

    if (this.#rules) {
      this.#rules = replaceRules(this.className, styles, this.#rules, registry.sheet);
    }
    for (const attachment of this.#attachments) {
      attachment.stopBindings();
      attachment.stopBindings = bindValues(attachment.c, attachment.element, bindings, interpolations);
    }
  }

  toString(): string {
    return this.className;
  }

  attach(c: Context, element: HTMLElement | SVGElement, condition: MaybeGetter<any> = true): () => void {
    const stopCondition = attachClass(c, this.className, element, condition);
    if (!stopCondition) return noop;

    this.#rules ??= registry.insertClass(this.className, this.#styles);

    const attachment: HotAttachment = {
      c,
      element,
      stopBindings: bindValues(c, element, this.#bindings, this.#interpolations),
    };
    this.#attachments.add(attachment);

    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      stopCondition();
      attachment.stopBindings();
      this.#attachments.delete(attachment);
    };

    onCleanup(c, detach);
    return detach;
  }

  when(condition: MaybeGetter<any>): ConditionalTemplate {
    return { [IS_CONDITIONAL_TEMPLATE]: true, template: this, condition };
  }
}

const hotTemplates = new Map<string, HotTemplate>();

/**
 * Returns the hot template for `id` (a module path and export name) with the given contents.
 * Used by the HMR runtime; see `__dolla_css`.
 */
export function hotTemplate(id: string, strings: TemplateStringsArray, interpolations: any[]): CSSTemplate {
  let template = hotTemplates.get(id);
  if (!template) {
    template = new HotTemplate(nameForKey("css", id, "hmr"));
    hotTemplates.set(id, template);
  }
  template.update(strings, interpolations);
  return template;
}

/*============================*\
||         css helper         ||
\*============================*/

export function css<P = {}>(strings: TemplateStringsArray, ...interpolations: Interpolation<P>[]): CSSTemplate {
  return createTemplate(strings, interpolations);
}

/**
 * Builds the base template of a styled component. Its rule goes in the styled
 * stylesheet, which comes before plain `css` rules, so classes passed into the
 * component win. Each call site gets its own class even when another component
 * has identical styles. Otherwise a wrapping styled component could share a
 * rule that was registered before the component it wraps, and lose to it.
 */
export function styledTemplate(strings: TemplateStringsArray, interpolations: any[]): CSSTemplate {
  return createTemplate(strings, interpolations, true);
}

/**
 * Registers a `@keyframes` rule and returns its generated name. Unlike a
 * `@keyframes` block written inside a `css` template, whose name is global,
 * the name is derived from the keyframes themselves, so two animations can't
 * overwrite each other. Identical keyframes share one name and rule.
 *
 * ```ts
 * const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
 * const panel = css`animation: ${fadeIn} 200ms ease-out;`;
 * ```
 */
export function keyframes(strings: TemplateStringsArray, ...interpolations: InterpolationValue[]): Keyframes {
  let body = "";
  strings.forEach((str, i) => {
    body += str;
    if (i < interpolations.length) body += interpolations[i] ?? "";
  });
  body = body.trim();

  const name = nameForKey("kf", body);
  registry.insertKeyframes(name, body);
  return { name, toString: () => name };
}
