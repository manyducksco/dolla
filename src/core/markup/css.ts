import { compile, middleware, prefixer, serialize, stringify } from "stylis";
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
    const compiled = serialize(compile(`.${className}{${rawCss}}`), middleware([prefixer, stringify]));
    const rules = compiled
      .split(/(?<=\})\s*(?=[.#@a-zA-Z:\*])/g)
      .map((r) => r.trim())
      .filter(Boolean);
    for (const rule of rules) {
      try {
        this.sheet.insertRule(rule, this.sheet.cssRules.length);
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

/*============================*\
||         css helper         ||
\*============================*/

export function css(strings: TemplateStringsArray, ...interpolations: any[]): CSSTemplate {
  const className = `css-${hashTemplate(strings, interpolations)}`;

  const template: CSSTemplate = {
    [IS_CSS_TEMPLATE]: true,

    className,
    children: [],

    toString() {
      return this.className;
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
