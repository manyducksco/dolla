import { Renderable } from ".";
import { contextualize } from "./context";
import { Context } from "./context";
import { Mutable, Reactive, reader, state } from "./reactive";

interface ElementAttribute<T> {
  type: (value: unknown) => T;
  default?: T;
}

interface ElementAttributeWithDefault<T> extends ElementAttribute<T> {
  default: T;
}

type ReactiveAttributes<T extends Record<string, ElementAttribute<unknown>>> = {
  [Name in keyof T]: Reactive<
    T[Name] extends ElementAttributeWithDefault<infer V>
      ? V
      : T[Name] extends ElementAttribute<infer V>
        ? V | undefined
        : never
  >;
};

interface ElementOptions<Attrs extends Record<string, ElementAttribute<unknown>>> {
  attributes?: Attrs;
  view: (attrs: ReactiveAttributes<Attrs>) => Renderable;
}

export function element<Attrs extends Record<string, ElementAttribute<unknown>>>(
  tag: string,
  options: ElementOptions<Attrs>,
) {
  customElements.define(
    tag,
    class extends HTMLElement {
      static observedAttributes = options.attributes ? Object.keys(options.attributes) : [];

      #attrs: Record<string, { parse: (value: unknown) => unknown; state: Mutable<unknown> }> = {};
      #context!: Context;
      #viewContent: Renderable;

      constructor() {
        super();

        if (options.attributes) {
          for (const key in options.attributes) {
            this.#attrs[key] = {
              parse: options.attributes[key].type,
              state: state(options.attributes[key].default),
            };
          }
        }
      }

      connectedCallback() {
        // Find context through event emitted up the chain
        this.dispatchEvent(
          new CustomEvent("dolla:seekContextParent", {
            detail: (context: Context) => {
              this.#context = context.createChild(tag);
            },
          }),
        );

        // No parent context. We're it.
        if (!this.#context) {
          this.#context = new Context(tag);
        }

        // Answer the call from children.
        this.addEventListener("dolla:seekContextParent", (event) => {
          event.stopPropagation();
          (event as CustomEvent<(context: Context) => void>).detail(this.#context);
        });

        // Initialize attrs for view function
        const attrs: Record<string, Reactive<unknown>> = {};
        for (const key in this.#attrs) {
          attrs[key] = reader(this.#attrs[key].state);
        }

        // Run the view function
        contextualize(this.#context, () => {
          this.#viewContent = options.view.call(this, attrs as ReactiveAttributes<Attrs>);
        });

        // 1. willMount

        // 2. didMount
      }

      disconnectedCallback() {}

      attributeChangedCallback(name: string, oldValue: unknown, newValue: unknown) {
        if (this.#attrs[name]) {
          const value = this.#attrs[name].parse(newValue);
          this.#attrs[name].state.set(value);
        }
      }
    },
  );
}

// TODO: Props/attrs reactivity
// export function element<Props>(tag: string, view: (this: HTMLElement, props: Props) => Renderable) {
//   // Define a custom element. Need to figure out how to handle props/attr mapping.

//   $connected(() => {});

//   $connectedMove(() => {});

//   $disconnected(() => {});

//   $adopted(() => {});
// }
