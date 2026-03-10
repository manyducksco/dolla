import { MarkupNode, render, Renderable } from ".";
import { callInContext, Context } from "./context";
import { Getter, Setter, state, untrack } from "./signals";

type AttributeDefault = string;
type AttributeParser = (val: string | undefined) => any;

export type AttributeDef = string | readonly [string, AttributeDefault | AttributeParser];

type AttributesMap = Record<string, { get: Getter<string | undefined>; set: Setter<string | undefined> }>;

export abstract class CoreDollaElement<const T extends readonly string[]> extends HTMLElement {
  _attrs: AttributesMap = {};
  #context!: Context;
  #node?: MarkupNode;
  #teardownTimer?: number;
  #isInitialized = false;
  #keepAliveTime = 0;

  constructor() {
    super();

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

  abstract create(): Renderable;

  trackAttribute(name: keyof T): string | undefined {
    return this._attrs[name as string]?.get();
  }

  _initializeComponent() {
    // Find context through event emitted up the chain
    this.dispatchEvent(
      new CustomEvent("dolla:seekContextParent", {
        bubbles: true,
        composed: true,
        detail: {
          element: this,
          callback: (context: Context) => {
            this.#context = context.createChild(this.localName);
          },
        },
      }),
    );
    // No parent context. We're it.
    if (!this.#context) this.#context = new Context(this.localName);

    // Initialize attrs for view function.
    const attrs: Record<string, Getter<unknown>> = {};
    for (const key in this._attrs) {
      attrs[key] = this._attrs[key].get;
    }

    // Run the view function
    const viewContent = callInContext(this.#context, () => {
      return untrack(() => this.create());
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
      this.#context.resume();
    }

    if (!this.#isInitialized) {
      // Delay context resolution to handle bottom-up upgrades safely
      queueMicrotask(() => this._initializeComponent());
    } else {
      // It's a move, not a mount. Re-attach the existing node.
      if (this.#node) this.#node.mount(this.shadowRoot!);
    }
  }

  disconnectedCallback() {
    this.#node?.unmount();

    this.#context.suspend();

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

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this._attrs[name]?.set(newValue);
  }
}

export function ElementWithAttrs<const T extends readonly string[]>(attributes: T) {
  const attrs: AttributesMap = {};
  for (const attr of attributes) {
    const [get, set] = state<string | undefined>();
    attrs[attr] = { get, set };
  }
  abstract class Mixin extends CoreDollaElement<T> {
    static observedAttributes = attributes;
    _attrs = attrs;
  }
  return Mixin;
}
