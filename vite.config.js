import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    sourcemap: true,

    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "jsx-runtime": resolve(__dirname, "src/jsx-runtime.js"),
        "jsx-dev-runtime": resolve(__dirname, "src/jsx-dev-runtime.js"),
      },
      name: "Dolla",
      formats: ["es"],
    },
  },
});
