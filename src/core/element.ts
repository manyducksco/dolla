import { $$context, MarkupNode, render, Renderable } from ".";
import { Context, hook } from "./context";
import { Getter, memo, Setter, state, peek, untrack } from "./signals";

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
      #teardownTimer?: number;
      #isInitialized = false;
      #keepAliveTime = 0;

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

        if (this.hasAttribute("keep-alive")) {
          this.#keepAliveTime = Number(this.getAttribute("keep-alive"));
        }

        this.addEventListener("dolla:seekContextParent", (event) => {
          event.stopPropagation();
          if (this.#context) {
            const { element, callback } = (
              event as CustomEvent<{ element: HTMLElement; callback: (context: Context) => void }>
            ).detail;

            if (element !== this) {
              callback(this.#context);
            }
          }
        });

        this.attachShadow({ mode: "open" });
      }

      private initializeComponent() {
        // Find context through event emitted up the chain
        this.dispatchEvent(
          new CustomEvent("dolla:seekContextParent", {
            bubbles: true,
            composed: true,
            detail: {
              element: this,
              callback: (context: Context) => {
                this.#context = context.createChild(tag);
              },
            },
          }),
        );
        // No parent context. We're it.
        if (!this.#context) this.#context = new Context(tag);

        // Initialize attrs for view function.
        const attrs: Record<string, Getter<unknown>> = {};
        for (const key in this.#attrs) {
          attrs[key] = this.#attrs[key].get;
        }

        // Run the view function
        const viewContent = hook(this.#context, () => {
          return untrack(() =>
            view.call(
              this,
              {
                attributes: attrs as AttributeGetters<T>,
                children: document.createElement("slot"),
              },
              this,
            ),
          );
        });

        // Mount the view
        if (viewContent != null && viewContent !== false) {
          this.#node = render(viewContent, this.#context);
          this.#node.mount(this.shadowRoot!);
        }

        // Run context lifecycle events
        this.#context.mount();
        this.#isInitialized = true;
      }

      connectedCallback() {
        // Cancel pending teardown if restored from cache
        if (this.#teardownTimer !== undefined) {
          clearTimeout(this.#teardownTimer);
          this.#teardownTimer = undefined;
        }

        if (!this.#isInitialized) {
          // Delay context resolution to handle bottom-up upgrades safely
          queueMicrotask(() => this.initializeComponent());
        } else {
          // It's a move, not a mount. Re-attach the existing node.
          if (this.#node) this.#node.mount(this.shadowRoot!);
          this.connectedMoveCallback();
        }
      }

      connectedMoveCallback() {
        this.#context.state[MOVED_CALLBACKS]?.forEach((callback: () => void) => callback());
      }

      disconnectedCallback() {
        this.#node?.unmount();

        this.#teardownTimer = window.setTimeout(() => {
          // Only destroy th element if it hasn't been re-connected in the meantime
          if (!this.isConnected) {
            this.#context.unmount();

            // Clear references so the garbage collector can free the memory
            this.#node = undefined;
            this.#isInitialized = false;
          }
        }, this.#keepAliveTime);
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
