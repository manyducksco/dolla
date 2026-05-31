import { MaybeGetter, onCleanup } from "..";
import { isFunction, uniqueId } from "../../utils";
import { Context, onEffect } from "../context";

const IS_CSS_TEMPLATE = Symbol.for("$_IS_CSS_TEMPLATE");

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
 * A template for a CSS snippet. Built when applied to an element.
 */
export type CSSTemplate = {
  [IS_CSS_TEMPLATE]: true;
  className: string;

  as(name: string): CSSTemplate;
  attach(c: Context, element: HTMLElement | SVGElement, condition?: MaybeGetter<any>): void;

  with(template: CSSTemplate, condition?: MaybeGetter<any>): CSSTemplate;
  children: [CSSTemplate, MaybeGetter<any>][];

  toString(): string;
};

/*============================*\
||           Helpers          ||
\*============================*/

export function isCSSTemplate(value: any): value is CSSTemplate {
  return value != null && value[IS_CSS_TEMPLATE] === true;
}

function hashTemplate(strings: TemplateStringsArray, interpolations: any[]): string {
  let statics = "";

  strings.forEach((str, i) => {
    statics += str;

    if (i < interpolations.length) {
      let expr = interpolations[i];

      if (isCSSTemplate(expr)) {
        // Include nested style references
        statics += `.${expr.className}`;
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
    return [
      (this.sheet.cssRules[index] as CSSStyleRule).style,
      () => {
        // TODO: Implement instance rule cleanup callback.
      },
    ];
  }

  addProperty(name: string, syntax: string, initialValue: any) {
    if (this.properties.has(name) || syntax === "*") return;

    try {
      CSS.registerProperty({
        name,
        syntax,
        inherits: false,
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

function createTemplate(prefix: string, strings: TemplateStringsArray, interpolations: any[]): CSSTemplate {
  const className = `${prefix}-${hashTemplate(strings, interpolations)}`;

  const template: CSSTemplate = {
    [IS_CSS_TEMPLATE]: true,

    className,
    children: [],

    toString() {
      return this.className;
    },

    as(name: string): CSSTemplate {
      const safe = sanitizeIdentifier(name);
      const hash = this.className.slice(this.className.indexOf("-") + 1);
      return { ...this, className: `${safe}-${hash}` };
    },

    attach(c, element, condition = true) {
      const bindings: CSSTemplateBinding[] = [];

      if (!attachClass(c, this.className, element, condition)) return;

      let styles = "";
      strings.forEach((str, i) => {
        styles += str;

        if (i < interpolations.length) {
          let expr = interpolations[i];

          if (isCSSTemplate(expr)) {
            styles += `.${expr.className}`;
            return;
          }

          let syntax = "*";
          let initialValue = null;

          if (Array.isArray(expr)) {
            [expr, syntax, initialValue = null] = expr;
          }

          if (typeof expr === "function") {
            const varName = `--${this.className}-${i}`;

            if (initialValue != null) {
              styles += `var(${varName}, ${initialValue})`;
              if (syntax !== "*") {
                registry.addProperty(varName, syntax, initialValue);
              }
            } else {
              styles += `var(${varName})`;
            }

            bindings.push({ varName, getter: expr, initialValue });
          } else {
            styles += expr;
          }
        }
      });

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

      this.children.forEach(([childTemplate, childCondition]) => {
        childTemplate.attach(c, element, childCondition);
      });
    },

    with(template: CSSTemplate, condition = true): CSSTemplate {
      return { ...this, children: [...this.children, [template, condition]] };
    },
  };

  return template;
}

/*============================*\
||         css helper         ||
\*============================*/

export function css(strings: TemplateStringsArray, ...interpolations: any[]): CSSTemplate {
  return createTemplate("css", strings, interpolations);
}

export namespace css {
  export function as(name: string): (strings: TemplateStringsArray, ...interpolations: any[]) => CSSTemplate {
    const safe = sanitizeIdentifier(name);
    return (strings, ...interpolations) => createTemplate(safe, strings, interpolations);
  }
}
