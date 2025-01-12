import fs from "node:fs";
import esbuild from "esbuild";

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    metafile: true,
    sourcemap: true,
    // minify: process.env.NODE_ENV === "production",
    outdir: "dist",
    format: "esm",
  })
  .then((result) => {
    fs.writeFileSync("esbuild-meta.json", JSON.stringify(result.metafile));
  });

esbuild.build({
  entryPoints: ["src/jsx-runtime.js"],
  bundle: false,
  minify: false,
  sourcemap: true,
  outdir: "dist",
  format: "esm",
});

esbuild.build({
  entryPoints: ["src/jsx-dev-runtime.js"],
  bundle: false,
  minify: false,
  sourcemap: true,
  outdir: "dist",
  format: "esm",
});
