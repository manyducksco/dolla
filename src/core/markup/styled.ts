import type { MaybeGetter, Renderable, View } from "../../types.js";
import type { Context } from "../context.js";
import { unwrap } from "../signals.js";
import { css } from "./css.js";
import { createMarkup } from "./utils.js";

/*============================*\
||            Types            ||
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
 * A tuple of `[getter, syntax, initialValue]` that tells the CSS engine how
 * to register a custom property via Houdini `@property`.
 */
export type HoudiniTuple<Props, Syntax extends CSSSyntaxDescriptor> = [
  getter: InterpolationFn<Props>,
  syntax: Syntax,
  initialValue: SyntaxValueType<Syntax>,
];

export type InterpolationValue = string | number | null | undefined;

export type InterpolationFn<Props> = (props: Props & Record<string, any>) => MaybeGetter<InterpolationValue>;

export type Interpolation<Props> = InterpolationValue | InterpolationFn<Props> | HoudiniTuple<Props, any>;

type StyledProps = {
  /**
   * Overrides the rendered tag for intrinsic elements. Ignored by the
   * wrapped View if it doesn't forward `as` to its root element.
   */
  as?: keyof JSX.IntrinsicElements | string;
};

/**
 * The rendered styled component accepts the base props plus an open-ended
 * record of any custom props (pass-through to the DOM / interpolations).
 */
export type StyledView<Props> = View<(Props & StyledProps) & Record<string, any>>;

interface TemplateFn<BaseProps = {}> {
  (strings: TemplateStringsArray, ...interpolations: Interpolation<BaseProps>[]): StyledView<BaseProps>;
  /**
   * Sets the CSS class name prefix. The hash part is unchanged, so the
   * sheet is deduplicated as if the same template were used.
   * Example: `styled.button.named("MyButton")\`…\`` produces `MyButton-<hash>`.
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
 * when one styled view wraps another) into a single-level array containing
 * the existing entries followed by the new template. Falsy entries are
 * dropped so they don't trip up `ElementNode`'s template extraction, which
 * only inspects one level of nesting for CSSTemplates.
 */
function composeClass(existing: unknown, tpl: any): unknown {
  if (existing == null) return [tpl];
  if (Array.isArray(existing)) {
    const flat = existing.flat(Infinity).filter((x) => x != null && x !== false);
    flat.push(tpl);
    return flat.length === 1 ? flat[0] : flat;
  }
  return [existing, tpl];
}

/**
 * Wraps an interpolation so function/tuple forms receive the rendered
 * component's props at evaluation time. Static values and nested CSSTemplates
 * pass through unchanged. The wrapping does not run the function eagerly; it
 * is only invoked from within an `onEffect` when the binding is tracked.
 */
function wrapInterpolation<Props>(ip: Interpolation<Props>, props: Props): any {
  const wrappedProps = props as Props & Record<string, any>;

  if (typeof ip === "function") {
    const fn = ip as InterpolationFn<Props>;
    return () => unwrap(fn(wrappedProps));
  }

  if (Array.isArray(ip)) {
    const [fn, syntax, initialValue] = ip as HoudiniTuple<Props, any>;
    return [() => unwrap((fn as InterpolationFn<Props>)(wrappedProps)), syntax, initialValue] as const;
  }

  return ip;
}

/*============================*\
||           Builder          ||
\*============================*/

function createBuilder<Tag extends keyof JSX.IntrinsicElements>(
  tag: Tag,
  boundName?: string,
  boundAs?: string,
): TemplateFn<JSX.IntrinsicElements[Tag]>;
function createBuilder<Props>(
  view: View<Props>,
  boundName?: string,
  boundAs?: string,
): TemplateFn<Props>;
function createBuilder(tagOrView: any, boundName?: string, boundAs?: string): TemplateFn<any> {
  function templateFn(strings: TemplateStringsArray, ...interpolations: any[]): StyledView<any> {
    // Insert the static class rule now so its position in the shared
    // stylesheet reflects definition order. Later templates (e.g.
    // `styled(MyButton)\`...\``) insert after this one and win specificity
    // ties via sheet order. The hash only depends on the statics, so the
    // render-time template produces the same className and the registry
    // dedups insertion. `preinsert` never invokes function interpolations.
    const initial = css(strings, ...interpolations);
    const tpl = boundName ? initial.named(boundName) : initial;
    tpl.preinsert();

    const StyledView: StyledView<any> = function StyledView(props, _context: Context) {
      const { as: instanceAs, ...rest } = props ?? {};
      const effectiveAs = instanceAs ?? boundAs;

      // Render-time template: same statics => same hash. `.named` only
      // swaps the prefix so the registry dedups the static rule.
      const wrapped = interpolations.map((ip) => wrapInterpolation(ip, rest));
      const renderInitial = css(strings, ...wrapped);
      const renderTpl = boundName ? renderInitial.named(boundName) : renderInitial;

      if (typeof tagOrView === "string") {
        // Intrinsic base: pick the tag locally; don't forward `as` to the DOM.
        const target = effectiveAs ?? tagOrView;
        return createMarkup(target, { ...rest, class: composeClass(rest.class, renderTpl) }) as Renderable;
      }
      // Wrapping a View: forward `as` so the wrapped view can pick its tag.
      const forwardProps = effectiveAs != null ? { ...rest, as: effectiveAs } : rest;
      return createMarkup(tagOrView, {
        ...forwardProps,
        class: composeClass(forwardProps.class, renderTpl),
      }) as Renderable;
    };

    Object.defineProperty(StyledView, "name", {
      value: `Styled(${boundName ?? (typeof tagOrView === "string" ? tagOrView : (tagOrView as any).name)})`,
      configurable: true,
    });

    return StyledView;
  }

  // Immutable chainable helpers: return new builders with the bound value set.
  templateFn.named = (name: string) => createBuilder(tagOrView, name, boundAs);
  templateFn.as = (tag: string) => createBuilder(tagOrView, boundName, tag);

  return templateFn as TemplateFn<any>;
}

/*============================*\
||            styled          ||
\*============================*/

/**
 * `styled` is both a callable builder (`styled(MyView)\`...\``) and a
 * proxy that exposes a builder for every intrinsic tag (`styled.button\`...\``,
 * `styled["my-custom-thing"]\`...\``).
 */
type Styled = typeof createBuilder & {
  [Tag in keyof JSX.IntrinsicElements]: TemplateFn<JSX.IntrinsicElements[Tag]>;
};

const styled = new Proxy(createBuilder as any, {
  get(_target, tag: string) {
    return createBuilder(tag);
  },
}) as Styled;

export { styled };
