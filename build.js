import fs from "node:fs";
import esbuild from "esbuild";

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    metafile: true,
    sourcemap: true,
    // minify: process.env.NODE_ENV === "production",
    outdir: "lib",
    format: "esm",
  })
  .then((result) => {
    fs.writeFileSync("esbuild-meta.json", JSON.stringify(result.metafile));
  });

esbuild.build({
  entryPoints: ["src/jsx/jsx-runtime.js"],
  bundle: false,
  minify: false,
  sourcemap: true,
  outdir: "lib/jsx",
  format: "esm",
});

esbuild.build({
  entryPoints: ["src/jsx/jsx-dev-runtime.js"],
  bundle: false,
  minify: false,
  sourcemap: true,
  outdir: "lib/jsx",
  format: "esm",
});
