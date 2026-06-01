import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    // Mangle any property name that starts with an underscore
    mangleProps: /^_/,
  },
  build: {
    sourcemap: true,
    minify: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/core/index.ts"),
        http: resolve(__dirname, "src/http/index.ts"),
        router: resolve(__dirname, "src/router/index.ts"),
        translate: resolve(__dirname, "src/translate/index.ts"),
        virtual: resolve(__dirname, "src/virtual/index.ts"),
        "jsx-runtime": resolve(__dirname, "src/jsx-runtime.js"),
        "jsx-dev-runtime": resolve(__dirname, "src/jsx-dev-runtime.js"),
        hmr: resolve(__dirname, "src/core/hmr.ts"),
      },
      name: "Dolla",
      formats: ["es"],
    },
  },
  test: {
    environment: "happy-dom",
  },
});
