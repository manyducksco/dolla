import { describe, expect, test } from "vitest";
import dollaPlugin from "./vite-plugin.js";
import { __dolla_css, __dolla_export, __dolla_store } from "./src/core/hmr.js";
import { css } from "./src/core/markup/css.js";
import { addStore, createContext, getStore } from "./src/core/context.js";

function runTransform(code: string, id: string) {
  // @ts-ignore — invoking the hook directly.
  return dollaPlugin().transform(code, id);
}

describe("dollaPlugin — HMR injection", () => {
  test("appends HMR apply call for files with named exports", () => {
    const result = runTransform(
      `export const Foo = () => null;\n`,
      "/abs/path/file.tsx",
    );
    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { __dolla_apply, __dolla_export, __dolla_store } from "@manyducks.co/dolla/hmr"');
    expect(result!.code).toContain("Foo");
    expect(result!.code).toContain("import.meta.hot.accept");
  });

  test("does not duplicate the HMR import if already present", () => {
    const code = `import { __dolla_apply } from "@manyducks.co/dolla/hmr";\nexport const Foo = 1;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    // Count the import statements (not the call site reference) to assert dedup.
    const importOccurrences = (result!.code.match(/import\s+\{[^}]*__dolla_apply[^}]*\}\s+from/g) ?? []).length;
    expect(importOccurrences).toBe(1);
  });

  test("injects HMR self-accept for no-export files in dev (entry boundary)", () => {
    const result = runTransform(`const x = 1;\n`, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { __dolla_apply, __dolla_export, __dolla_store } from "@manyducks.co/dolla/hmr"');
    expect(result!.code).toContain("import.meta.hot.accept");
  });

  test("makes the entry module a self-accept boundary (export let without initializer)", () => {
    // The app entry exports `export let appContext;` which has no `=`/`:`, so
    // it is not rewritten into a live-binding proxy — but it must still receive
    // an `import.meta.hot.accept` so an HMR update to a deeply-nested
    // dependency is contained here instead of bubbling to a full reload.
    const code = `export let appContext;\nconst root = createRoot("#app");\n`;
    const result = runTransform(code, "/abs/app.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain("import.meta.hot.accept");
    // The export must be preserved verbatim (not rewritten).
    expect(result!.code).toContain("export let appContext");
  });

  test("places the self-accept boundary at the top, before any user code", () => {
    // Registering at the top (not the bottom) is critical: a heavy view module
    // can throw during Vite's HMR re-evaluation, which would otherwise prevent
    // the bottom-placed boundary from registering and force a full reload that
    // duplicates the mounted route.
    const code = `import { Something } from "./dep";\nexport function TaskModal() { return null; }\n`;
    const result = runTransform(code, "/abs/views/TaskModal/TaskModal.tsx");
    expect(result).not.toBeNull();
    const acceptIdx = result!.code.indexOf("import.meta.hot.accept");
    // The user's own import is the first surviving statement; the boundary
    // must precede it.
    const userCodeIdx = result!.code.indexOf("import { Something }");
    expect(acceptIdx).toBeGreaterThanOrEqual(0);
    expect(acceptIdx).toBeLessThan(userCodeIdx);
  });

  test("registers `export async function` for HMR and live bindings", () => {
    const code = `export async function Loader() { return null; }\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toMatch(/__dolla_apply\(newModule, \{ Loader \}\)/);
    expect(result!.code).toContain("\nasync function Loader()");
    expect(result!.code).toContain(`Loader = __dolla_export("/abs/file.tsx:Loader", Loader);`);
    expect(result!.code).toContain("export { Loader };");
  });

  test("registers `export default async function Name` for HMR", () => {
    const code = `export default async function Page() { return null; }\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toMatch(/__dolla_apply\(newModule, \{ default: Page \}\)/);
  });

  test("source map names the source file and includes its content", () => {
    const code = `export function Foo() { return null; }\n`;
    const result = runTransform(code, "/abs/views/Foo.tsx");
    const map = result!.map as any;
    expect(map.sources).toEqual(["/abs/views/Foo.tsx"]);
    expect(map.sourcesContent).toEqual([code]);
  });

  test("returns null for files inside node_modules", () => {
    const result = runTransform(`export const Foo = 1;\n`, "/abs/project/node_modules/pkg/file.tsx");
    expect(result).toBeNull();
  });

  test("returns null for non-JS extensions", () => {
    const result = runTransform(`export const Foo = 1;\n`, "/abs/file.css");
    expect(result).toBeNull();
  });

  test("only runs in dev", () => {
    expect(dollaPlugin().apply).toBe("serve");
  });
});

describe("dollaPlugin — styled namer (dev only)", () => {
  const IMPORT = `import { styled } from "@manyducks.co/dolla/styled";\n`;

  test("injects .named(\"IDENT\") for const-styled intrinsic", () => {
    const code = IMPORT + `const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.button.named("MyButton")`);
  });

  test("handles export const", () => {
    const code = IMPORT + `export const PageContainer = styled.div\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("PageContainer")`);
  });

  test("handles styled(<View>) wrapping", () => {
    const code = IMPORT + `const MyLink = styled(MyButton)\`\n  color: blue;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled(MyButton).named("MyLink")`);
  });

  test("handles styled('custom-thing') string tag", () => {
    const code = IMPORT + `const Thing = styled("my-thing")\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled("my-thing").named("Thing")`);
  });

  test("handles styled['box'] bracket tag", () => {
    const code = IMPORT + `const Box = styled["box"]\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled["box"].named("Box")`);
  });

  test("injects .named AFTER existing .as(\"tag\") chain (orthogonal)", () => {
    const code = IMPORT + `const MyLink = styled.button.as("a")\`\n  color: blue;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.button.as("a").named("MyLink")`);
  });

  test("skips injection if .named already in chain (idempotency)", () => {
    const code = IMPORT + `export const X = styled.button.named("Already")\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    // The existing .named("Already") should remain; no second .named injected.
    expect(result!.code).toContain(`.named("Already")`);
    expect((result!.code.match(/\.named\(/g) ?? []).length).toBe(1);
  });

  test("does not rewrite destructuring assignments", () => {
    const code = IMPORT + `const { Foo } = styled;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    // No styled declaration to rewrite, but HMR self-accept is still injected.
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("rewrites multiple styled declarations in one file", () => {
    const code = IMPORT + [
      `const A = styled.div\`\n  color: red;\n\`;`,
      `const B = styled.span\`\n  color: blue;\n\`;`,
    ].join("\n");
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("A")`);
    expect(result!.code).toContain(`styled.span.named("B")`);
  });

  test("running transform twice is idempotent", () => {
    const code = IMPORT + `export const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const first = runTransform(code, "/abs/file.tsx");
    expect(first).not.toBeNull();
    const second = runTransform(first!.code, "/abs/file.tsx");
    expect(second).not.toBeNull();
    // Second pass should not double-inject .named.
    expect((second!.code.match(/\.named\(/g) ?? []).length).toBe(1);
  });

  test("skips styled inside an existing string literal", () => {
    const code = IMPORT + `const s = "styled.button";\nconst X = styled.div\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("X")`);
    // The string-literal occurrence should not be touched.
    expect(result!.code).toContain(`"styled.button";`);
  });

  test("does not rewrite a `styled` imported from another library", () => {
    const code = `import styled from "@emotion/styled";\nconst Title = styled.h1\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("does not rewrite `styled` when no import of it exists", () => {
    const code = `const Title = styled.h1\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).not.toContain(".named(");
  });

  test("does not rewrite member access like `theme.styled.span`", () => {
    const code = IMPORT + `const Label = theme.styled.span\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).not.toContain(".named(");
    expect(result!.code).toContain("theme.styled.span`");
  });

  test("does not borrow the name of an unrelated earlier const", () => {
    const code = IMPORT + `const theme = { color: "red" };\nfunction make() { return styled.button\`color: red;\`; }\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).not.toContain(".named(");
  });

  test("does not borrow a const name across an intervening expression", () => {
    const code = IMPORT + `const Wrapped = wrap(styled.div\`color: red;\`);\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).not.toContain(".named(");
  });

  test("names declarations in large files without rescanning the whole prefix", () => {
    const lines: string[] = [];
    for (let n = 0; n < 8000; n++) {
      lines.push(`const S${n} = styled.div\`color: red;\`;`);
    }
    const code = IMPORT + lines.join("\n") + "\n";
    const start = performance.now();
    const result = runTransform(code, "/abs/file.tsx");
    const elapsed = performance.now() - start;
    expect(result!.code).toContain(`const S0 = styled.div.named("S0")`);
    expect(result!.code).toContain(`const S7999 = styled.div.named("S7999")`);
    expect(elapsed).toBeLessThan(1000);
  });

  test("handles template literals with `${}` inside the chain arguments", () => {
    const code = IMPORT + "const Thing = styled.button.as(`${tag}`)`color: red;`;\n";
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain('styled.button.as(`${tag}`).named("Thing")`color: red;`');
  });

  test("handles `${}` containing braces inside the chain arguments", () => {
    const code = IMPORT + "const Thing = styled(make(`${ { a: '}' }.a }`))`color: red;`;\n";
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain(".named(\"Thing\")`color: red;`");
  });

  test("rewrites an aliased dolla styled import", () => {
    const code = `import { styled as s } from "@manyducks.co/dolla/styled";\nconst Title = s.h1\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain(`s.h1.named("Title")`);
  });
});

describe("dollaPlugin — export detection ignores non-code", () => {
  test("ignores `export function` inside a block comment", () => {
    const code = `/**\n * Usage:\n * export function MyView() {}\n */\nexport const Real = () => null;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain("MyView =");
    expect(result!.code).not.toContain("export { MyView }");
    expect(result!.code).toContain(" * export function MyView() {}");
    expect(result!.code).not.toMatch(/__dolla_apply\(newModule, \{[^}]*MyView/);
  });

  test("ignores `export function` inside a line comment", () => {
    const code = `// export function MyView() {}\nexport const Real = 1;\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).not.toContain("MyView =");
    expect(result!.code).toContain("// export function MyView() {}");
  });

  test("does not rewrite `export function` inside a template literal", () => {
    const code = "export const snippet = `export function Demo() {}`;\n";
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain("`export function Demo() {}`");
    expect(result!.code).not.toContain("Demo =");
  });

  test("does not rewrite `export function` inside a string literal", () => {
    const code = `export const snippet = "export function Demo() {}";\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain(`"export function Demo() {}"`);
    expect(result!.code).not.toContain("Demo =");
  });

  test("does not hoist exports nested inside a namespace", () => {
    const code = `export namespace NS {\n  export function helper() {}\n}\nexport function Top() {}\n`;
    const result = runTransform(code, "/abs/file.ts");
    expect(result!.code).toContain("  export function helper() {}");
    expect(result!.code).not.toContain("helper =");
    expect(result!.code).toContain(`Top = __dolla_export("/abs/file.ts:Top", Top);`);
    expect(result!.code).toContain("export { Top };");
  });

  test("still rewrites a top-level export after a template literal with an expression", () => {
    const code = "const a = `x ${{ b: 1 }.b} y`;\nexport function After() {}\n";
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain(`After = __dolla_export("/abs/file.tsx:After", After);`);
  });

  test("a regex literal containing a quote does not hide later exports", () => {
    const code = `const re = /["']/g;\nexport function After() {}\n`;
    const result = runTransform(code, "/abs/file.tsx");
    expect(result!.code).toContain(`After = __dolla_export("/abs/file.tsx:After", After);`);
  });
});

describe("dollaPlugin — live bindings for const and default exports", () => {
  let fileCount = 0;
  const uniqueId = () => `/abs/live-${fileCount++}.js`;

  /**
   * Runs a transformed module (plain JS only) with the real `__dolla_export`
   * and returns its exports, so hot-reload identity can be checked directly.
   */
  function evaluateModule(code: string, prelude = ""): Record<string, any> {
    const declared: string[] = [];
    const body = code
      .replace(/^import \{[^}]*\} from "@manyducks\.co\/dolla\/hmr";\n/m, "")
      .replace(/^import \{[^}]*\} from "@manyducks\.co\/dolla";\n/m, "")
      .replace(/import\.meta\.hot/g, "undefined")
      .replace(/export \{([^}]*)\};/g, (_m, names: string) =>
        names
          .split(",")
          .map((part) => {
            const [local, exported = local] = part.trim().split(/\s+as\s+/);
            return `__exports[${JSON.stringify(exported.trim())}] = ${local.trim()};`;
          })
          .join(" "),
      )
      .replace(/^export (const|let|function|class) ([A-Za-z_$][\w$]*)/gm, (_m, kw: string, name: string) => {
        declared.push(name);
        return `${kw} ${name}`;
      });
    const exports: Record<string, any> = {};
    const tail = declared.map((name) => `__exports.${name} = ${name};`).join("\n");
    // `prelude` runs before any of the module's own statements, as a module in an import cycle can be
    // called into before it evaluates. Its function declarations are hoisted but not yet wrapped.
    new Function(
      "__dolla_export",
      "__dolla_store",
      "__exports",
      "addStore",
      "getStore",
      "createContext",
      `${prelude}\n${body}\n${tail}`,
    )(__dolla_export, __dolla_store, exports, addStore, getStore, createContext);
    return exports;
  }

  function reload(id: string, ...versions: string[]) {
    return versions.map((code) => evaluateModule(runTransform(code, id)!.code));
  }

  test("wraps an exported const arrow function", () => {
    const id = uniqueId();
    const result = runTransform(`export const useCounter = (props, c) => ({ n: 1 });\n`, id);
    expect(result!.code).toContain("let useCounter = (props, c) =>");
    expect(result!.code).toContain(`useCounter = __dolla_export("${id}:useCounter", useCounter);`);
    expect(result!.code).toContain("export { useCounter };");
  });

  test("an exported const function keeps its identity across reloads and runs the new code", () => {
    const [v1, v2] = reload(
      uniqueId(),
      `export const getValue = () => 1;\n`,
      `export const getValue = () => 2;\n`,
    );
    expect(v2.getValue).toBe(v1.getValue);
    expect(v1.getValue()).toBe(2);
  });

  test("references inside the module use the wrapped function", () => {
    const [mod] = reload(uniqueId(), `export const Store = () => ({});\nexport function getStoreRef() { return Store; }\n`);
    expect(mod.getStoreRef()).toBe(mod.Store);
  });

  test.each([
    ["function expression", "function () { return 1; }"],
    ["named function expression", "function inner() { return 1; }"],
    ["async function expression", "async function () { return 1; }"],
    ["arrow with no params", "() => 1"],
    ["arrow with one bare param", "x => 1"],
    ["async arrow", "async () => 1"],
    ["async arrow with a bare param", "async x => 1"],
    ["arrow with a call in a default param", "(a = Math.max(1, 2)) => 1"],
    ["arrow with a block body", "(a, b) => {\n  return 1;\n}"],
  ])("wraps a const initialized with a %s", (_label, init) => {
    const [v1, v2] = reload(uniqueId(), `export const fn = ${init};\n`, `export const fn = ${init};\n`);
    expect(typeof v1.fn).toBe("function");
    expect(v2.fn).toBe(v1.fn);
  });

  test.each([
    ["a type annotation", "export const S: Store<{}, { n: number }> = (props, c) => ({ n: 1 });"],
    ["a function type annotation", "export const T: (a: number) => void = (a) => {};"],
    ["generic arrow", "export const G = <T,>(x: T): T => x;"],
    ["return type annotation", "export const R = (x: number): number => x;"],
  ])("wraps a TypeScript const function with %s", (_label, code) => {
    const id = uniqueId().replace(/\.js$/, ".ts");
    const name = code.match(/export const (\w+)/)![1];
    const result = runTransform(`${code}\n`, id);
    expect(result!.code).toContain(`let ${name}`);
    expect(result!.code).toContain(`${name} = __dolla_export("${id}:${name}", ${name});`);
  });

  test.each([
    ["a class", "export const C = class {};"],
    ["a number", "export const n = 1;"],
    ["a call result", "export const made = make(() => 1);"],
    ["a styled component", 'import { styled } from "@manyducks.co/dolla/styled";\nexport const Box = styled.div`color: red;`;'],
    ["destructuring", "export const { a } = obj;"],
    ["several declarators", "export const one = () => 1, two = () => 2;"],
    ["let", "export let mutable = () => 1;"],
  ])("does not wrap an exported const holding %s", (_label, code) => {
    const result = runTransform(`${code}\n`, uniqueId());
    expect(result!.code).not.toMatch(/\w+ = __dolla_export\(/);
    expect(result!.code).toContain("export ");
  });

  test("wraps a named default export function", () => {
    const id = uniqueId();
    const result = runTransform(`export default function Page() { return 1; }\n`, id);
    expect(result!.code).toContain("\nfunction Page()");
    expect(result!.code).toContain(`Page = __dolla_export("${id}:default", Page);`);
    expect(result!.code).toContain("export { Page as default };");
    expect(result!.code).toMatch(/__dolla_apply\(newModule, \{ default: Page \}\)/);
  });

  test("a named default export keeps its identity across reloads", () => {
    const [v1, v2] = reload(
      uniqueId(),
      `export default function Page() { return 1; }\n`,
      `export default function Page() { return 2; }\n`,
    );
    expect(v2.default).toBe(v1.default);
    expect(v1.default()).toBe(2);
    expect(v1.default.name).toBe("Page");
  });

  test("an anonymous default export function keeps its identity across reloads", () => {
    const id = uniqueId();
    const result = runTransform(`export default function () { return 1; }\n`, id);
    expect(result!.code).toMatch(/__dolla_apply\(newModule, \{ default: __dolla_default \}\)/);

    const [v1, v2] = reload(id, `export default function () { return 1; }\n`, `export default function () { return 2; }\n`);
    expect(v2.default).toBe(v1.default);
    expect(v1.default()).toBe(2);
  });

  test("wraps a default export async function", async () => {
    const [v1, v2] = reload(
      uniqueId(),
      `export default async function load() { return 1; }\n`,
      `export default async function load() { return 2; }\n`,
    );
    expect(v2.default).toBe(v1.default);
    await expect(v1.default()).resolves.toBe(2);
  });

  test("a const store found before a reload is still found after it", () => {
    const [v1, v2] = reload(
      uniqueId(),
      `export const CounterStore = (props, c) => ({ count: 1 });\n`,
      `export const CounterStore = (props, c) => ({ count: 2 });\n`,
    );
    const ctx = createContext(null);
    const store = addStore(ctx, v1.CounterStore);
    expect(getStore(ctx, v2.CounterStore)).toBe(store);
  });

  test("a private store is still found through its helpers after a reload", () => {
    const authModule = (user: string) =>
      [
        `import { addStore, getStore } from "@manyducks.co/dolla";`,
        `function AuthStore(_, c) { return { user: ${JSON.stringify(user)} }; }`,
        `export function addAuth(c) { return addStore(c, AuthStore); }`,
        `export function getAuth(c) { return getStore(c, AuthStore); }`,
        ``,
      ].join("\n");
    const id = uniqueId();
    const ctx = createContext(null);
    const [v1] = reload(id, authModule("first"));
    const store = v1.addAuth(ctx);
    const [v2] = reload(id, authModule("second"));
    expect(v2.getAuth(createContext(ctx))).toBe(store);
  });

  test("a private const store is still found after a reload", () => {
    const counterModule = (count: number) =>
      [
        `const CounterStore = (_, c) => ({ count: ${count} });`,
        `export const addCounter = (c) => addStore(c, CounterStore);`,
        `export const getCounter = (c) => getStore(c, CounterStore);`,
        ``,
      ].join("\n");
    const id = uniqueId();
    const ctx = createContext(null);
    const [v1] = reload(id, counterModule(1));
    const store = v1.addCounter(ctx);
    const [v2] = reload(id, counterModule(2));
    expect(v2.getCounter(ctx)).toBe(store);
  });

  test("a private store added while its module evaluates is found afterwards", () => {
    const [v1] = reload(
      uniqueId(),
      [
        `export const root = createContext(null);`,
        `addStore(root, SessionStore);`,
        `function SessionStore() { return { id: 1 }; }`,
        `export function getSession() { return getStore(root, SessionStore); }`,
        ``,
      ].join("\n"),
    );
    expect(v1.getSession().id).toBe(1);
  });

  test("a private store keeps working when the reloaded module is used before it evaluates", () => {
    // Quack's case: auth.ts -> rpc.ts -> app.tsx -> Workspace.tsx -> stores. Editing Workspace.tsx
    // re-runs the cycle, and the new app.tsx calls the new auth.ts's addAuth before auth.ts evaluates.
    const authModule = (user: string) =>
      [
        `function AuthStore(_, c) { return { user: ${JSON.stringify(user)} }; }`,
        `export function addAuth(c) { return addStore(c, AuthStore); }`,
        `export function getAuth(c) { return getStore(c, AuthStore); }`,
        ``,
      ].join("\n");
    const id = uniqueId();
    const oldRoot = createContext(null);
    const [v1] = reload(id, authModule("first"));
    const oldStore = v1.addAuth(oldRoot);

    // The new app.tsx builds a new root and calls the hoisted, still unwrapped addAuth.
    const prelude = `__exports.newRoot = createContext(null); __exports.newStore = addAuth(__exports.newRoot);`;
    const v2 = evaluateModule(runTransform(authModule("second"), id)!.code, prelude);

    expect(v2.newStore.user).toBe("second");
    // HMR then re-renders the old root's views, which look the store up with the new getAuth.
    expect(v2.getAuth(createContext(oldRoot))).toBe(oldStore);
    expect(v2.getAuth(createContext(v2.newRoot))).toBe(v2.newStore);
  });

  test("leaves functions that aren't passed to a store function alone", () => {
    const { code } = runTransform(
      [
        `function helper() {}`,
        `// addStore(c, InComment)`,
        `function InComment() {}`,
        `const text = "getStore(c, InString)";`,
        `function InString() {}`,
        `export const useIt = (c) => c.getStore(c, helper);`,
        ``,
      ].join("\n"),
      uniqueId(),
    )!;
    expect(code).not.toMatch(/__dolla_store\(/);
  });

  test("doesn't tag store names that aren't module declarations", () => {
    const { code } = runTransform(
      [
        `declare function Ambient(): {};`,
        `const value = function Named() {};`,
        `(function Iife() {})();`,
        `export const use = (c) => [getStore(c, Ambient), getStore(c, Named), getStore(c, Iife)];`,
        ``,
      ].join("\n"),
      uniqueId(),
    )!;
    expect(code).not.toMatch(/__dolla_store\(/);
  });
});

describe("dollaPlugin — hot css templates", () => {
  let fileCount = 0;
  const uniqueId = () => `/abs/styles-${fileCount++}.ts`;
  const transform = (code: string, id = uniqueId()) => runTransform(code, id)!.code;

  /** Runs a transformed module (plain JS only) and returns its top-level `box` binding. */
  function evaluateBox(code: string) {
    const body = code
      .replace(/^import \{[^}]*\} from "@manyducks\.co\/dolla(?:\/hmr)?";\n/gm, "")
      .replace(/import\.meta\.hot/g, "undefined")
      .replace(/^export /gm, "");
    return new Function("__dolla_css", "css", "style", `${body}\nreturn box;`)(__dolla_css, css, css);
  }

  test("wraps an exported css template in a hot template", () => {
    const id = uniqueId();
    const code = transform(`import { css } from "@manyducks.co/dolla";\nexport const box = css\`color: red;\`;\n`, id);
    expect(code).toContain("__dolla_css");
    expect(code).toContain(`export const box = __dolla_css(${JSON.stringify(`${id}:box`)})\`color: red;\`;`);
  });

  test("keeps the template's identity and class name when the module reloads", () => {
    const id = uniqueId();
    const first = evaluateBox(transform(`import { css } from "@manyducks.co/dolla";\nexport const box = css\`color: red;\`;\n`, id));
    const second = evaluateBox(transform(`import { css } from "@manyducks.co/dolla";\nexport const box = css\`color: blue;\`;\n`, id));
    expect(second).toBe(first);
  });

  test("wraps templates with an aliased tag, a type annotation, or no export", () => {
    const aliased = transform(`import { type Context, css as style } from "@manyducks.co/dolla";\nexport const box = style\`a: b;\`;\n`);
    expect(aliased).toMatch(/const box = __dolla_css\("[^"]+:box"\)`a: b;`/);

    const annotated = transform(`import { css, type CSSTemplate } from "@manyducks.co/dolla";\nexport const box: CSSTemplate = css\`a: b;\`;\n`);
    expect(annotated).toMatch(/const box: CSSTemplate = __dolla_css\("[^"]+:box"\)`a: b;`/);

    const local = transform(`import { css } from "@manyducks.co/dolla";\nconst box = css\`a: b;\`\nexport { box };\n`);
    expect(local).toMatch(/const box = __dolla_css\("[^"]+:box"\)`a: b;`/);
  });

  test("leaves templates it can't keep stable alone", () => {
    const cases = [
      // Not dolla's css.
      `import { css } from "@emotion/css";\nexport const box = css\`a: b;\`;\n`,
      // The template is not the whole initializer.
      `import { css } from "@manyducks.co/dolla";\nexport const box = css\`a: \${\`b\`};\`.when(on);\n`,
      `import { css } from "@manyducks.co/dolla";\nexport const box = css\`a: b;\`\n  .when(on);\n`,
      `import { css } from "@manyducks.co/dolla";\nexport const box = on ? css\`a: b;\` : null;\n`,
      // Not at the top level.
      `import { css } from "@manyducks.co/dolla";\nexport function View() {\n  const box = css\`a: b;\`;\n  return box;\n}\n`,
    ];
    for (const code of cases) {
      expect(transform(code)).not.toContain("__dolla_css(");
    }
  });
});

describe("dollaPlugin — import cycle warning", () => {
  const ROOT = "/project";

  type FakeModule = {
    url: string;
    file: string;
    importers: Set<FakeModule>;
    importedModules: Set<FakeModule>;
    staticImportedUrls: Set<string>;
  };

  /** Builds a fake Vite module graph. `dynamic` lists edges that are dynamic `import()`s. */
  function moduleGraph(imports: Record<string, string[]>, dynamic: Record<string, string[]> = {}) {
    const mods = new Map<string, FakeModule>();
    const get = (url: string) => {
      let mod = mods.get(url);
      if (!mod) {
        mod = { url, file: ROOT + url, importers: new Set(), importedModules: new Set(), staticImportedUrls: new Set() };
        mods.set(url, mod);
      }
      return mod;
    };
    const link = (from: string, to: string, isStatic: boolean) => {
      get(from).importedModules.add(get(to));
      get(to).importers.add(get(from));
      if (isStatic) get(from).staticImportedUrls.add(to);
    };
    for (const [from, tos] of Object.entries(imports)) for (const to of tos) link(from, to, true);
    for (const [from, tos] of Object.entries(dynamic)) for (const to of tos) link(from, to, false);
    return get;
  }

  /** A plugin that has seen `rootModule` call createRoot, plus a function to send it hot updates. */
  function setup(rootModule = "/src/app.tsx") {
    const plugin: any = dollaPlugin();
    plugin.configResolved({ root: ROOT });
    plugin.transform(`import { createRoot } from "@manyducks.co/dolla";\ncreateRoot("#app").mount(App);\n`, ROOT + rootModule);
    const warnings: string[] = [];
    const update = (mod: FakeModule, environment = "client") =>
      plugin.hotUpdate.call(
        { environment: { name: environment, logger: { warn: (msg: string) => warnings.push(msg) } } },
        { type: "update", file: mod.file, modules: [mod] },
      );
    return { warnings, update };
  }

  // Quack's graph: the auth store imports rpc.ts, which imports the app entry.
  const quackImports = {
    "/src/app.tsx": ["/src/pages/Workspace.tsx", "/src/stores/index.ts"],
    "/src/pages/Workspace.tsx": ["/src/stores/index.ts"],
    "/src/stores/index.ts": ["/src/stores/auth.ts"],
    "/src/stores/auth.ts": ["/src/rpc.ts"],
    "/src/rpc.ts": ["/src/app.tsx"],
  };

  test("warns with the cycle when an edit re-runs the module that creates the root", () => {
    const mod = moduleGraph(quackImports);
    const { warnings, update } = setup();

    expect(update(mod("/src/pages/Workspace.tsx"))).toBeUndefined();

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Editing src/pages/Workspace.tsx re-runs src/app.tsx");
    expect(warnings[0]).toContain(
      [
        "  src/pages/Workspace.tsx",
        "  -> src/stores/index.ts",
        "  -> src/stores/auth.ts",
        "  -> src/rpc.ts",
        "  -> src/app.tsx",
        "  -> src/pages/Workspace.tsx",
      ].join("\n"),
    );
    expect(warnings[0]).toContain("src/rpc.ts imports src/app.tsx");
  });

  test("warns once per cycle", () => {
    const mod = moduleGraph(quackImports);
    const { warnings, update } = setup();

    update(mod("/src/pages/Workspace.tsx"));
    update(mod("/src/pages/Workspace.tsx"));
    update(mod("/src/stores/auth.ts"));

    expect(warnings).toHaveLength(1);
  });

  test("doesn't warn when nothing imports the root module back", () => {
    const mod = moduleGraph({ ...quackImports, "/src/rpc.ts": [] });
    const { warnings, update } = setup();

    update(mod("/src/pages/Workspace.tsx"));
    update(mod("/src/stores/auth.ts"));

    expect(warnings).toEqual([]);
  });

  test("doesn't warn about a cycle the root module isn't part of", () => {
    const mod = moduleGraph({
      "/src/app.tsx": ["/src/stores/a.ts"],
      "/src/stores/a.ts": ["/src/stores/b.ts"],
      "/src/stores/b.ts": ["/src/stores/a.ts"],
    });
    const { warnings, update } = setup();

    update(mod("/src/stores/a.ts"));

    expect(warnings).toEqual([]);
  });

  test("ignores cycles closed by a dynamic import", () => {
    const mod = moduleGraph({ ...quackImports, "/src/rpc.ts": [] }, { "/src/rpc.ts": ["/src/app.tsx"] });
    const { warnings, update } = setup();

    update(mod("/src/pages/Workspace.tsx"));

    expect(warnings).toEqual([]);
  });

  test("only checks the client environment", () => {
    const mod = moduleGraph(quackImports);
    const { warnings, update } = setup();

    update(mod("/src/pages/Workspace.tsx"), "ssr");

    expect(warnings).toEqual([]);
  });
});
