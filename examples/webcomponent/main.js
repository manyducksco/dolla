import { $, effect, when } from "../../dist/index.js";

class EffectScope {
  #observing = false;
  #observers = [];
  #cleanups = [];

  get observing() {
    return this.#observing;
  }

  observe(callback) {
    this.#observers.push(callback);
    if (this.#observing) {
      this.#cleanups.push(effect(callback));
    }
  }

  start() {
    this.#observing = true;
    for (const callback of this.#observers) {
      this.#cleanups.push(effect(callback));
    }
  }

  stop() {
    this.#observing = false;
    for (const cleanup of this.#cleanups) {
      cleanup();
    }
    this.#cleanups.length = 0;
  }
}

function setAttribute(el, attr, value) {
  // handle special case attributes
  el.setAttribute(attr, value);
}

function createElement(tag, attrs, children) {
  // attrs can contain signals as values
  // children can contain signals as values

  // signals will be observed while the element is connected.

  const el = document.createElement(tag);
  const scope = new EffectScope();

  for (const key in attrs) {
    if (typeof attrs[key] === "function") {
      // determine if it's an event handler or a signal
      // this is determined by the name beginning with "on"
      if (key.startsWith("on")) {
        el.addEventListener(key.slice(2), attrs[key]);
      } else {
        // if signal then add an observer on the scope.
        scope.observe(() => {
          setAttribute(el, key, attrs[key]());
        });
      }
    } else {
      // attr is static
      setAttribute(el, key, attrs[key]);
    }
  }

  for (const child of children) {
    if (typeof child === "function") {
      // transform into a dynamic element
      // for now just printing it as a string
      const node = document.createTextNode(String(child()));
      console.log("HELLO", node, child);
      scope.observe(() => {
        node.textContent = String(child());
      });
      el.appendChild(node);
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  // run custom setup logic on connect and disconnect
  el.$dolla = {
    connected: false,
    connect() {
      if (this.connected) return;
      console.log(el, "$dolla connected");
      scope.start();

      for (const child of el.childNodes) {
        if ("$dolla" in child) {
          child.$dolla.connect();
        }
      }
    },
    disconnect() {
      if (!this.connected) return;
      console.log(el, "$dolla disconnected");
      scope.stop();

      for (const child of el.childNodes) {
        if ("$dolla" in child) {
          child.$dolla.disconnect();
        }
      }
    },
  };

  return el;
}

function mount(element, parent) {
  // Observe childList changes on subtree and run lifecycle callbacks.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ("$dolla" in node) {
          node.$dolla.connect();
        }
      }

      for (const node of mutation.removedNodes) {
        if ("$dolla" in node) {
          node.$dolla.disconnect();
        }
      }
    }
  });
  observer.observe(parent, { childList: true, subtree: true });

  parent.appendChild(element);
}

// const html = htm.bind(createElement);

// need array of all event handler names

class DollaElement extends HTMLElement {
  connectedCallback() {
    if (this.template) {
      mount(this.template, this);
    }
  }
}

class MyCounter extends DollaElement {
  count = $(0);
  increment = () => this.count((x) => x + 1);

  template = createElement("div", {}, [
    createElement("span", {}, ["Clicks: ", this.count]),
    createElement("button", { onclick: this.increment }, ["Click Me!"]),
    () => this.count() > 10 && createElement("span", {}, ["That's a lot of clicks."]),
  ]);

  // template = html`
  //   <span>Clicks: ${this.count}</span>
  //   <button onclick=${this.increment}>Click Me!</button>
  //   ${() => this.count() > 10 && html`<span>That's a lot!</span>`}
  // `;
}

customElements.define("my-counter", MyCounter);
