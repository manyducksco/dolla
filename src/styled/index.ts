import type { Context } from "../core/context.js";
import { css, type CSSTemplate, type Interpolation } from "../core/markup/css.js";
import { IS_STYLED_VIEW, type StyledTemplate } from "../core/markup/css-template.js";
import { ElementNode } from "../core/markup/nodes/element.js";
import { ViewNode } from "../core/markup/nodes/view.js";
import { isFunction } from "../utils.js";
import type { IntrinsicElements, View } from "../types.js";

/*============================*\
||            Types           ||
\*============================*/

type StyledProps = {
  /**
   * Overrides the rendered tag for intrinsic elements. Ignored by the
   * wrapped View if it doesn't forward `as` to its root element.
   */
  as?: keyof IntrinsicElements | string;
};

/**
 * The rendered styled component accepts the base props plus an open-ended
 * record of any custom props (pass-through to the DOM / interpolations).
 */
export type StyledView<Props> = View<(Props & StyledProps) & Record<string, any>> & StyledTemplate;

export interface TemplateFn<BaseProps = {}> {
  (strings: TemplateStringsArray, ...interpolations: Interpolation<BaseProps>[]): StyledView<BaseProps>;
  /**
   * Sets the styled component's View name to `Styled(name)`. In debug mode,
   * `data-view` shows this name on rendered elements. Class names are not
   * affected, so identical styles still share one `css-<hash>` rule.
   */
  named(name: string): TemplateFn<BaseProps>;
  /**
   * Overrides the rendered tag. For an intrinsic base, picks the tag
   * locally. For a wrapped View, forwards `as` as a prop so the wrapped
   * component can decide. Per-instance `as` prop at render time wins.
   */
  as(tag: string): TemplateFn<BaseProps>;
}

/*============================*\
||           Helpers          ||
\*============================*/

/**
 * Flattens an incoming `class` value (which may itself be a nested array
 * when one styled view wraps another) into a single-level array. The styled
 * template is placed first so that wrappers and caller-supplied templates
 * win the cascade through stylesheet insertion order.
 *
 * Falsy entries are dropped so they don't trip up `ElementNode`'s template
 * extraction, which only inspects one level of nesting for CSSTemplates.
 */
function composeClass(existing: unknown, tpl: CSSTemplate): unknown {
  if (existing == null || existing === false || existing === "") return tpl;

  if (isFunction(existing)) {
    // Preserve reactive class values by letting the element resolve the
    // getter, then composing the result with the styled class.
    return () => composeClass((existing as () => unknown)(), tpl);
  }

  if (Array.isArray(existing)) {
    const flat = existing.flat(Infinity).filter((value) => value != null && value !== false);
    return [tpl, ...flat];
  }

  return [tpl, existing];
}

/**
 * Builds the final props object in a single pass, dropping `class`,
 * `className`, and `as` before applying the styled class and optional tag
 * override. One allocation instead of a rest object plus a spread matters for
 * large lists of styled elements.
 */
function buildProps(props: Record<string, any> | null | undefined, classes: unknown, as?: string): Record<string, any> {
  const next: Record<string, any> = {};

  if (props) {
    for (const key in props) {
      if (key === "class" || key === "className" || key === "as") continue;
      next[key] = props[key];
    }
  }

  if (as != null) next.as = as;
  next.class = classes;
  return next;
}

/*============================*\
||           Builder          ||
\*============================*/

function createBuilder<Tag extends keyof IntrinsicElements>(
  tag: Tag,
  boundName?: string,
  boundAs?: string,
): TemplateFn<IntrinsicElements[Tag]>;
function createBuilder<Props>(view: View<Props>, boundName?: string, boundAs?: string): TemplateFn<Props>;
function createBuilder(tag: string, boundName?: string, boundAs?: string): TemplateFn<Record<string, any>>;
function createBuilder(tagOrView: string | View<any>, boundName?: string, boundAs?: string): TemplateFn<any> {
  function templateFn(strings: TemplateStringsArray, ...interpolations: any[]): StyledView<any> {
    // A single template serves both selector interpolation and rendering.
    // `css` recognizes styled views in interpolations and emits their class
    // names, so no separate "render-time" template is needed.
    const template = css(strings, ...interpolations);

    const StyledView = function StyledView(props: any, context: Context) {
      const rawProps = props ?? {};
      const effectiveAs = rawProps.as ?? boundAs;
      const classes = composeClass(rawProps.class ?? rawProps.className, template);

      if (typeof tagOrView === "string") {
        // Intrinsic base: pick the tag locally; don't forward `as` to the DOM.
        const target = effectiveAs ?? tagOrView;
        return new ElementNode(context, target, buildProps(rawProps, classes));
      }

      // Wrapping a View: forward `as` so the wrapped view can pick its tag.
      return new ViewNode(context, tagOrView, buildProps(rawProps, classes, effectiveAs));
    } as unknown as StyledView<any>;

    Object.defineProperty(StyledView, "name", {
      value: `Styled(${boundName ?? (typeof tagOrView === "string" ? tagOrView : (tagOrView as any).name || "View")})`,
      configurable: true,
    });

    (StyledView as any)[IS_STYLED_VIEW] = template;

    return StyledView;
  }

  // Immutable chainable helpers: return new builders with the bound value set.
  templateFn.named = (name: string) => createBuilder(tagOrView as any, name, boundAs);
  templateFn.as = (tag: string) => createBuilder(tagOrView as any, boundName, tag);

  return templateFn;
}

/*============================*\
||           styled           ||
\*============================*/

/**
 * `styled` is both a callable builder (`styled(MyView)\`...\``) and a
 * proxy that exposes a builder for every intrinsic tag (`styled.button\`...\``,
 * `styled["my-custom-thing"]\`...\``).
 */
type Styled = typeof createBuilder & {
  [Tag in keyof IntrinsicElements]: TemplateFn<IntrinsicElements[Tag]>;
} & {
  [tag: string]: TemplateFn<any>;
};

const styled = new Proxy(createBuilder as any, {
  get(target, tag) {
    if (typeof tag !== "string") return Reflect.get(target, tag);
    if (tag in target) return Reflect.get(target, tag);
    return createBuilder(tag);
  },
}) as Styled;

export { styled };
