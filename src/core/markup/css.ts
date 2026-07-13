import { MaybeGetter, onCleanup } from "..";
import type { Interpolation } from "./styled.js";
import { isFunction, uniqueId } from "../../utils";
import { Context, onEffect } from "../context";

const IS_CSS_TEMPLATE = Symbol.for("$_IS_CSS_TEMPLATE");
const IS_CONDITIONAL_TEMPLATE = Symbol.for("$_IS_CONDITIONAL_TEMPLATE");

/*============================*\
||           Types            ||
\*============================*/

/**
 * A getter bound to a CSS variable name.
 */
export type CSSTemplateBinding = {
  varName: string;
  getter: () => any;
  initialValue: any;
};

/**
 * A wrapper around a CSSTemplate that conditionally applies it.
 */
export type ConditionalTemplate = {
  [IS_CONDITIONAL_TEMPLATE]: true;
  template: CSSTemplate;
  condition: MaybeGetter<any>;
};

/**
 * A template for a CSS snippet. Built when applied to an element.
 */
export type CSSTemplate = {
  [IS_CSS_TEMPLATE]: true;
  className: string;

  named(name: string): CSSTemplate;
  attach(c: Context, element: HTMLElement | SVGElement, condition?: MaybeGetter<any>): void;
  when(condition: MaybeGetter<any>): ConditionalTemplate;

  /**
   * Inserts the static class rule into the shared stylesheet without binding
   * any per-instance reactive values to an element. Useful when the rule must
   * be in the sheet at module-evaluation time so that later templates can
   * override it via stylesheet order (e.g. `styled(MyButton)\`...\``).
   * Safe to call multiple times; the registry dedups by className.
   */
  preinsert(): void;

  toString(): string;
};

/*============================*\
||           Helpers          ||
\*============================*/

export function isCSSTemplate(value: any): value is CSSTemplate {
  return value != null && value[IS_CSS_TEMPLATE] === true;
}

export function isConditionalTemplate(value: any): value is ConditionalTemplate {
  return value != null && value[IS_CONDITIONAL_TEMPLATE] === true;
}

export function isStyledComponent(value: any): boolean {
  return typeof value === "function" && (value as any).__cssTemplate != null;
}

function getTemplateClassName(value: any): string | undefined {
  if (isCSSTemplate(value)) return value.className;
  if (isStyledComponent(value)) return (value as any).__cssTemplate.className;
  return undefined;
}

function hashTemplate(strings: TemplateStringsArray, interpolations: any[]): string {
  let statics = "";

  strings.forEach((str, i) => {
    statics += str;

    if (i < interpolations.length) {
      let expr = interpolations[i];

      const className = getTemplateClassName(expr);
      if (className != null) {
        statics += `.${className}`;
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

  createInstanceRule(className: string): [CSSStyleDeclaration, () => void] {
    const index = this.sheet.cssRules.length;
    this.sheet.insertRule(`.${className}{}`, index);
    const style = (this.sheet.cssRules[index] as CSSStyleRule).style;
    return [
      style,
      () => {
        const rules = this.sheet.cssRules;
        for (let i = 0; i < rules.length; i++) {
          if ((rules[i] as CSSStyleRule).style === style) {
            this.sheet.deleteRule(i);
            return;
          }
        }
      },
    ];
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

/**
 * Sanitizes a string so it can be used as a CSS class name prefix.
 * Replaces invalid characters with hyphens, collapses runs, and
 * strips leading/trailing hyphens.
 */
function sanitizeIdentifier(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "css"
  );
}

/*============================*\
||     Template builder       ||
\*============================*/

/**
 * Walks the template strings/interpolations and produces the final CSS string
 * (with `var(--className-N)` placeholders for function interpolations) plus
 * the list of reactive bindings that need per-instance wiring.
 *
 * Pure: no context, no element, no side effects beyond optional Houdini
 * `@property` registration (deduped by the registry). Used by both
 * `preinsert` (static rule insertion) and `attach` (per-element binding).
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
      if (
        typeof expr === "object" &&
        expr !== null &&
        !Array.isArray(expr) &&
        "syntax" in expr &&
        "value" in expr
      ) {
        const config = expr as {
          syntax: string;
          value: (() => any) | any;
          initialValue?: any;
          inherits?: boolean;
        };
        const { syntax, value, initialValue, inherits } = config;
        const varName = `--${className}-${i}`;
        const getter = typeof value === "function" ? value : () => value;

        if (initialValue != null) {
          styles += `var(${varName}, ${initialValue})`;
          if (syntax !== "*") {
            registry.addProperty(varName, syntax, initialValue, inherits ?? false);
          }
        } else {
          styles += `var(${varName})`;
        }

        bindings.push({ varName, getter, initialValue });
      } else if (typeof expr === "function") {
        const varName = `--${className}-${i}`;
        styles += `var(${varName})`;
        bindings.push({ varName, getter: expr, initialValue: null });
      } else {
        styles += expr;
      }
    }
  });

  return { styles, bindings };
}

function createTemplate(prefix: string, strings: TemplateStringsArray, interpolations: any[]): CSSTemplate {
  const className = `${prefix}-${hashTemplate(strings, interpolations)}`;

  const template: CSSTemplate = {
    [IS_CSS_TEMPLATE]: true,

    className,

    toString() {
      return this.className;
    },

    named(name: string): CSSTemplate {
      const safe = sanitizeIdentifier(name);
      const hash = this.className.slice(this.className.indexOf("-") + 1);
      return { ...this, className: `${safe}-${hash}` };
    },

    preinsert() {
      const { styles } = buildStyles(this.className, strings, interpolations);
      registry.insertClass(this.className, styles);
    },

    attach(c, element, condition = true) {
      if (!attachClass(c, this.className, element, condition)) return;

      const { styles, bindings } = buildStyles(this.className, strings, interpolations);

      registry.insertClass(this.className, styles);

      if (bindings.length > 0) {
        const instanceClassName = `css-instance-${uniqueId()}`;

        attachClass(c, instanceClassName, element, condition);

        const [styleRef, cleanupStyleRef] = registry.createInstanceRule(instanceClassName);

        onEffect(c, () => {
          bindings.forEach(({ varName, getter, initialValue }) => {
            const val = getter();

            if (val === null || val === undefined || val === initialValue) {
              styleRef.removeProperty(varName);
            } else {
              styleRef.setProperty(varName, val);
            }
          });
        });

        onCleanup(c, cleanupStyleRef);
      }
    },

    when(condition: MaybeGetter<any>): ConditionalTemplate {
      return { [IS_CONDITIONAL_TEMPLATE]: true, template: this, condition };
    },
  };

  return template;
}

/*============================*\
||         css helper         ||
\*============================*/

export function css<P = {}>(strings: TemplateStringsArray, ...interpolations: Interpolation<P>[]): CSSTemplate {
  return createTemplate("css", strings, interpolations);
}

export namespace css {
  export function named<P = {}>(name: string): (strings: TemplateStringsArray, ...interpolations: Interpolation<P>[]) => CSSTemplate {
    const safe = sanitizeIdentifier(name);
    return (strings, ...interpolations) => createTemplate(safe, strings, interpolations);
  }
}
