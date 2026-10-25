import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const root = process.cwd();
const core = resolve(root, "src/core/index.ts");
const internals = resolve(root, "src/internals.ts");
const jsxRuntime = resolve(root, "src/jsx-runtime.js");

const ENTRY = "\0dolla:tree-shaking-entry";
const KB = 1024;
let problems = 0;

function report(message) {
  console.error(`[tree-shaking] ${message}`);
  problems++;
}

async function measure(code) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    oxc: { mangleProps: /^_/ },
    build: {
      write: false,
      minify: true,
      rollupOptions: { input: "virtual:entry" },
      target: "es2022",
    },
    plugins: [
      {
        name: "tree-shaking-entry",
        resolveId(id) {
          if (id === "virtual:entry") return ENTRY;
        },
        load(id) {
          if (id === ENTRY) return code;
        },
      },
    ],
  });

  const output = (Array.isArray(result) ? result : [result])[0].output;
  const chunks = output.filter((chunk) => chunk.type === "chunk");
  const modules = new Set(
    chunks.flatMap((chunk) => Object.keys(chunk.modules ?? {}).map((id) => id.replaceAll("\\", "/"))),
  );
  const gzip = chunks.reduce((total, chunk) => total + gzipSync(Buffer.from(chunk.code), { level: 9 }).length, 0);

  return { gzip, modules };
}

function expectModuleAbsent(result, name, context) {
  for (const id of result.modules) {
    if (id.endsWith(name)) {
      report(`${context}: unexpected module ${name}`);
    }
  }
}

function expectGzipBelow(result, budget, context) {
  if (result.gzip > budget) {
    report(`${context}: ${result.gzip} B gz exceeds budget of ${budget} B`);
  }
}

const imports = {
  core: `import { createAtom, createRoot } from ${JSON.stringify(core)};`,
  jsx: `import { jsx } from ${JSON.stringify(jsxRuntime)};`,
};

const counter = `
const [getCount, setCount] = createAtom(0);
const counter = () => jsx("button", { onClick: () => setCount(getCount() + 1), children: getCount });
`;

// Signals should not drag in any rendering code.
{
  const result = await measure(`
    import { createAtom } from ${JSON.stringify(core)};
    const [getCount, setCount] = createAtom(0);
    setCount(getCount() + 1);
  `);
  expectGzipBelow(result, 3.3 * KB, "signals-only app");
  for (const id of result.modules) {
    if (id.includes("/src/core/markup/")) {
      report(`signals-only app: unexpected rendering module ${id}`);
    }
  }
}

// A normal component app must not include opt-in helpers or the CSS builder.
{
  const result = await measure(`
    ${imports.core}
    ${imports.jsx}
    ${counter}
    createRoot(document.body, () => jsx("main", { children: [counter()] }));
  `);
  expectGzipBelow(result, 8.9 * KB, "minimal component app");
  for (const name of [
    "/src/core/markup/css.ts",
    "/src/core/markup/html.ts",
    "/src/core/markup/transition.ts",
    "/src/core/markup/debounce.ts",
    "/src/core/markup/throttle.ts",
    "/src/core/markup/nodes/repeat.ts",
    "/src/core/markup/nodes/branch.ts",
    "/src/core/markup/nodes/portal.ts",
    "/src/core/ref.ts",
  ]) {
    expectModuleAbsent(result, name, "minimal component app");
  }
}

// Optional helpers must not pull in their siblings.
{
  const result = await measure(`
    ${imports.core}
    ${imports.jsx}
    import { showIf } from ${JSON.stringify(core)};
    ${counter}
    createRoot(document.body, () =>
      jsx("main", { children: [counter(), showIf(getCount, jsx("p", { children: "on" }))] }),
    );
  `);
  expectModuleAbsent(result, "/src/core/markup/nodes/repeat.ts", "showIf app");
  expectModuleAbsent(result, "/src/core/markup/nodes/portal.ts", "showIf app");
}

// Transition must not import the html parser.
{
  const result = await measure(`
    ${imports.core}
    ${imports.jsx}
    import { transition } from ${JSON.stringify(core)};
    ${counter}
    createRoot(document.body, () =>
      jsx("main", {
        children: [
          counter(),
          transition({
            when: getCount,
            enter: [{ opacity: 0 }, { opacity: 1 }],
            children: jsx("p", { children: "fade" }),
          }),
        ],
      }),
    );
  `);
  expectModuleAbsent(result, "/src/core/markup/html.ts", "transition app");
  expectModuleAbsent(result, "/src/core/markup/nodes/repeat.ts", "transition app");
}

// Importing internals store inspection must not pull in the renderer.
{
  const result = await measure(`
    import { hasStore, hasOwnStore } from ${JSON.stringify(internals)};
    const context = {};
    function Store() {}
    console.log(hasStore(context, Store), hasOwnStore(context, Store));
  `);
  expectGzipBelow(result, 0.5 * KB, "internals store-inspection app");
  for (const id of result.modules) {
    if (id.includes("/src/core/markup/")) {
      report(`internals store-inspection app: unexpected rendering module ${id}`);
    }
  }
}

if (problems > 0) {
  process.exitCode = 1;
} else {
  console.log("[tree-shaking] bundles look good");
}
