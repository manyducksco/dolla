import { MOUNT, Router } from "../router/router";
import { Env, View } from "../types";
import { Context } from "./context";
import { MarkupNode } from "./markup";
import { ViewInstance } from "./nodes/view";
import { MaybeSignal } from "./signals";
import { DefaultCrashView, CrashViewProps } from "./views/default-crash-view";

// const app = createApp("Chat", () => {
//   return <h1>Test</h1>;
// });

// app.mount("#app");

export class App extends Context {
  #env: Env = "production";
  #root?: MarkupNode;
  #view?: View<{}>;
  #router?: Router;
  #crashView: View<CrashViewProps> = DefaultCrashView;

  constructor(name: MaybeSignal<string>, view: View<{}> | Router) {
    super(name, {});
    if (view instanceof Router) {
    }
  }

  setCrashView(view: View<CrashViewProps>) {
    this.#crashView = view;
    return this;
  }

  setLogLevels() {
    return this;
  }

  setLogFilter() {
    return this;
  }

  setEnv(value: Env) {
    this.#env = value;
    return this;
  }

  getEnv(): Env {
    return this.#env;
  }

  async mount(parent: Element): Promise<void>;
  async mount(selector: string): Promise<void>;

  async mount(parent: Element | string) {
    if (typeof parent === "string") {
      parent = document.querySelector(parent)!;
      if (parent == null) {
        throw new Error(`Selector '${parent}' did not match any element.`);
      }
    }

    if (this.#router) {
      this.#root = await this.#router[MOUNT](parent, this);
    } else if (this.#view) {
      this.#root = new ViewInstance(this, this.#view, {});
    } else {
      // THROW ERROR
    }

    Context.willMount(this);
  }

  async unmount() {}
}

// export function createApp(name: string) {
//   return new App(name);
// }
