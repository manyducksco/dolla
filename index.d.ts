export * from "./src/core/index";

import type { IntrinsicElements as Elements } from "./src/types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
