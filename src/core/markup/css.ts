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

export type InterpolationValue = string | number | null | undefined;

export type Interpolation<Props = {}> =
  | InterpolationValue
  | Getter<InterpolationValue>
  | PropertyConfig<any>
  | CSSTemplate
  | StyledTemplate;

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

function hashTemplate(strings: TemplateStringsArray, interpolations: any[]): string {
  let statics = "";

  strings.forEach((str, i) => {
    statics += str;

    if (i < interpolations.length) {
      let expr = interpolations[i];

      const className = getTemplateClassName(expr);
      if (className != null) {
        // Nested CSSTemplate: include its className so equivalent templates
        // dedup (e.g. `${base} { ... }` vs `${baseCopy} { ... }`).
        statics += `.${className}`;
      } else if (typeof expr === "function") {
        // Reactive getter: the function reference is not part of the rendered
        // CSS (it becomes a `var(--…)` binding).  Skipping it preserves dedup
        // across `css\`color: ${hue};\`` defined in two places.
      } else if (isPropertyConfig(expr)) {
        // PropertyConfig: the static-defining fields are `syntax` and
        // `initialValue` (the `value` getter becomes a CSS var binding).
        statics += `~${expr.syntax}|${String(expr.initialValue ?? "")}`;
      } else {
        // Static primitive (string/number/null/undefined) or other value:
        // include its stringification so `css\`font-size: ${size};\`` and
        // `css\`font-size: 14px;\`` produce distinct classNames when the
        // static parts differ only in interpolation values.
        statics += String(expr);
      }
    }
  });

  statics = statics.trim();

  let hash = 0;
  for (let i = 0; i < statics.length; i++) {
    hash = (Math.imul(31, hash) + statics.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function isPropertyConfig(value: any): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "syntax" in value && "value" in value;
}

function attachClass(c: Context, className: string, element: HTMLElement | SVGElement, condition?: MaybeGetter<any>) {
  if (isFunction(condition)) {
    onEffect(c, () => {
      element.classList.toggle(className, Boolean(condition()));
    });
    return true;
  } else if (Boolean(condition)) {
    element.classList.add(className);
    return true;
  } else {
    return false;
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

/**
 * Scans CSS and extracts at-rules that cannot be nested inside a style rule
 * (@keyframes, @font-face, @property, @counter-style, @page, @font-feature-values).
 * These are returned separately so they can be inserted as top-level rules,
 * while the remaining CSS is wrapped in the class selector and inserted
 * as a single style rule (relying on native CSS Nesting for @media etc.).
 */
function extractNonNestableAtRules(css: string): { cleanCss: string; extracted: string[] } {
  const extracted: string[] = [];

  let result = "";
  let i = 0;

  while (i < css.length) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      result += css.slice(i, end !== -1 ? end + 2 : css.length);
      i = end !== -1 ? end + 2 : css.length;
      continue;
    }

    if (css[i] === "@") {
      const start = i;
      i++;

      let name = "";
      while (i < css.length && /[a-z-]/i.test(css[i])) name += css[i++];

      if (nonNestableAtRules.has(name)) {
        while (i < css.length && css[i] !== "{") i++;

        if (i < css.length) {
          const atRuleStart = start;
          let depth = 0;
          while (i < css.length) {
            if (css[i] === "/" && css[i + 1] === "*") {
              const end = css.indexOf("*/", i + 2);
              i = end !== -1 ? end + 2 : css.length;
              continue;
            }
            if (css[i] === "{") depth++;
            else if (css[i] === "}") {
              depth--;
              if (depth === 0) {
                i++;
                extracted.push(css.slice(atRuleStart, i));
                break;
              }
            }
            i++;
          }
        }
      } else {
        result += css.slice(start, i);
      }
    } else {
      result += css[i++];
    }
  }

  return { cleanCss: result, extracted };
}

/*============================*\
||          Registry          ||
\*============================*/

class StyleRegistry {
  sheet = new CSSStyleSheet();
  classes = new Set<string>();
  properties = new Set<string>();

  constructor() {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet];
    if (typeof window !== "undefined") {
      const dbg = ((window as any).__dollaDbg ??= {});
      dbg.registry = this;
    }
  }

  insertClass(className: string, rawCss: string): void {
    if (this.classes.has(className)) return;

    const { cleanCss, extracted } = extractNonNestableAtRules(rawCss);

    for (const rule of extracted) {
      try {
        this.sheet.insertRule(rule, this.sheet.cssRules.length);
      } catch (e) {}
    }

    if (cleanCss.trim()) {
      try {
        this.sheet.insertRule(`.${className}{${cleanCss}}`, this.sheet.cssRules.length);
      } catch (e) {}
    }

    this.classes.add(className);
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
      } else {
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
};

// Template literals keep the same `strings` object per call site, so these
// caches let inline `css` calls in views reuse work across mounts.
const staticTemplatesByStrings = new WeakMap<TemplateStringsArray, CSSTemplate>();
const staticTemplates = new Map<string, CSSTemplate>();
const shapesByClassName = new Map<string, TemplateShape>();
const shapesByStrings = new WeakMap<TemplateStringsArray, TemplateShape>();

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

  attach(c: Context, element: HTMLElement | SVGElement, condition: MaybeGetter<any> = true): void {
    if (!attachClass(c, this.className, element, condition)) return;

    const shape = this.#shape;

    if (!shape.registered) {
      registry.insertClass(this.className, shape.styles);
      shape.registered = true;
    }

    if (shape.bindings.length > 0) {
      const interpolations = this.#interpolations;

      onEffect(c, () => {
        for (const binding of shape.bindings) {
          const value = binding.read(interpolations);

          if (value === null || value === undefined || value === binding.initialValue) {
            element.style.removeProperty(binding.varName);
          } else {
            element.style.setProperty(binding.varName, value);
          }
        }
      });

      onCleanup(c, () => {
        for (const binding of shape.bindings) {
          element.style.removeProperty(binding.varName);
        }
      });
    }
  }

  when(condition: MaybeGetter<any>): ConditionalTemplate {
    return { [IS_CONDITIONAL_TEMPLATE]: true, template: this, condition };
  }
}

function createTemplate(strings: TemplateStringsArray, interpolations: any[]): CSSTemplate {
  if (interpolations.length === 0) {
    const cached = staticTemplatesByStrings.get(strings);
    if (cached) return cached;
  }

  const allFunctions = interpolations.length > 0 && interpolations.every((expr) => isReactiveFunction(expr));
  let shape = allFunctions ? shapesByStrings.get(strings) : undefined;
  let className: string;
  let isStatic = false;

  if (shape) {
    className = shape.className;
  } else {
    className = `css-${hashTemplate(strings, interpolations)}`;
    isStatic = interpolations.every((expr) => !isReactiveFunction(expr) && !isPropertyConfig(expr));

    if (isStatic) {
      const cached = staticTemplates.get(className);
      if (cached) return cached;
    }

    shape = shapesByClassName.get(className);

    if (!shape) {
      const built = buildStyles(className, strings, interpolations);
      shape = {
        className,
        styles: built.styles,
        bindings: built.bindings,
        registered: false,
      };
      shapesByClassName.set(className, shape);
    }

    if (allFunctions) {
      shapesByStrings.set(strings, shape);
    }
  }

  const template = new CSSFactoryTemplate(shape, interpolations);

  if (isStatic) {
    staticTemplates.set(className, template);
    if (interpolations.length === 0) {
      staticTemplatesByStrings.set(strings, template);
    }
  }

  return template;
}

/*============================*\
||         css helper         ||
\*============================*/

export function css<P = {}>(strings: TemplateStringsArray, ...interpolations: Interpolation<P>[]): CSSTemplate {
  return createTemplate(strings, interpolations);
}
