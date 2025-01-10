import { onMount, mount } from "./modules/core.js";

// signals
import { createSignal, derive, watch } from "./signals.js";
export { createSignal, derive, watch };

// module: http
import http from "./modules/http.js";
export { http };
export type { HTTPRequest, HTTPResponse } from "./modules/http.js";

// module: render
import * as render from "./modules/render.js";
export { render };

// Markup
export { type Ref, isRef, createRef as ref, m, cond, repeat, portal } from "./markup.js";

// Views
export { Fragment } from "./views/fragment.js";

// Types
export type { ViewContext } from "./view.js";
export type { Markup } from "./markup.js";
export type { InputType, Renderable } from "./types.js";

import type { IntrinsicElements as Elements } from "./types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}

export default {
  // signals
  createSignal,
  derive,
  watch,

  // modules
  http,
  render,

  onMount,
  mount,
};
