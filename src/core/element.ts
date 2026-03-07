import { $$context, MarkupNode, render, Renderable } from ".";
import { Context, contextualize } from "./context";
import { Getter, memo, Setter, state, peek } from "./reactive";

type AttributeDefault = string;
type AttributeParser = (val: string | undefined) => any;

export type AttributeDef = string | readonly [string, AttributeDefault | AttributeParser];

type ExtractAttrValue<T> =
  // Plain string -> returns string | undefined
  T extends string
    ? string | undefined
    : // Tuple -> extract the second element
      T extends readonly [string, infer Config]
      ? // It's a parser function -> return its ReturnType
        Config extends (val: string | undefined) => infer ReturnType
        ? ReturnType
        : // It's a primitive default -> return the primitive
          Config
      : never;

type AttributeGetters<T extends readonly any[]> = {
  [Item in T[number] as Item extends string
    ? Item
    : Item extends readonly [infer Name extends string, any]
      ? Name
      : never]: () => ExtractAttrValue<Item>;
};

const MOVED_CALLBACKS = Symbol.for("Dolla.MovedCallbacks");
const ADOPTED_CALLBACKS = Symbol.for("Dolla.AdoptedCallbacks");

export function element<const T extends readonly AttributeDef[]>({
  tag,
  attributes,
  view,
}: {
  tag: `${string}-${string}`;
  attributes?: T;
  view: (
    this: HTMLElement,
    props: { children: Renderable; attributes: AttributeGetters<T> },
    element: HTMLElement,
  ) => Renderable;
}): void {
  const attrsList = attributes || ([] as unknown as T);

  customElements.define(
    tag,
    class extends HTMLElement {
      static observedAttributes = attrsList.map((item) => (typeof item === "string" ? item : item[0]));

      #attrs: Record<string, { get: Getter<unknown>; set: Setter<string | undefined> }> = {};
      #context!: Context;
      #node?: MarkupNode;

      constructor() {
        super();

        for (const attr of attrsList) {
          const [key, def] = typeof attr === "string" ? [attr, undefined] : attr;

          const [getRaw, set] = state<string | undefined>();

          const get =
            typeof def === "function"
              ? memo(() => {
                  const val = getRaw();
                  return peek(() => def(val)); // Peek ensures the parser itself isn't tracked
                })
              : () => getRaw() ?? def;

          this.#attrs[key] = { get, set };
        }

        this.attachShadow({ mode: "open" });
      }

      connectedCallback() {
        // Find context through event emitted up the chain
        this.dispatchEvent(
          new CustomEvent("dolla:seekContextParent", {
            bubbles: true,
            composed: true,
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

        // Initialize attrs for view function.
        const attrs: Record<string, Getter<unknown>> = {};
        for (const key in this.#attrs) {
          attrs[key] = this.#attrs[key].get;
        }

        // Run the view function
        const viewContent = contextualize(this.#context, () => {
          return view.call(
            this,
            {
              attributes: attrs as AttributeGetters<T>,
              children: document.createElement("slot"),
            },
            this,
          );
        });

        // Mount the view
        if (viewContent != null && viewContent !== false) {
          this.#node = render(viewContent, this.#context);
          this.#node.mount(this.shadowRoot!);
        }

        // Run context lifecycle events
        this.#context.mount();
      }

      connectedMoveCallback() {
        this.#context.state[MOVED_CALLBACKS]?.forEach((callback: () => void) => callback());
      }

      disconnectedCallback() {
        this.#node?.unmount();
        this.#node = undefined;

        this.#context.unmount();
      }

      adoptedCallback() {
        this.#context.state[ADOPTED_CALLBACKS]?.forEach((callback: () => void) => callback());
      }

      attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        this.#attrs[name]?.set(newValue);
      }
    },
  );
}

export function $moved(callback: () => void) {
  const context = $$context();
  if (!context.state[MOVED_CALLBACKS]) {
    context.state[MOVED_CALLBACKS] = [];
  }
  const list = context.state[MOVED_CALLBACKS];
  list.push(callback);
  return () => {
    list.splice(list.indexOf(callback), 1);
  };
}

export function $adopted(callback: () => void) {
  const context = $$context();
  if (!context.state[ADOPTED_CALLBACKS]) {
    context.state[ADOPTED_CALLBACKS] = [];
  }
  const list = context.state[ADOPTED_CALLBACKS];
  list.push(callback);
  return () => {
    list.splice(list.indexOf(callback), 1);
  };
}
