import { describe, expect, test } from "vitest";
import dollaPlugin from "./vite-plugin.js";

function runTransform(code: string, id: string, command: "serve" | "build") {
  const plugin = dollaPlugin();
  // The transform hook reads `command` from one of several possible locations
  // depending on Vite version. Set all of them so the test doesn't care.
  const ctx: any = { environment: { command, config: { command } }, config: { command } };
  // @ts-ignore — invoking the hook directly.
  return plugin.transform.call(ctx, code, id);
}

describe("dollaPlugin — HMR injection", () => {
  test("appends HMR apply call for files with named exports", () => {
    const result = runTransform(
      `export const Foo = () => null;\n`,
      "/abs/path/file.tsx",
      "serve",
    );
    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { __dolla_apply, __dolla_export } from "@manyducks.co/dolla/hmr"');
    expect(result!.code).toContain("Foo");
    expect(result!.code).toContain("import.meta.hot.accept");
  });

  test("does not duplicate the HMR import if already present", () => {
    const code = `import { __dolla_apply } from "@manyducks.co/dolla/hmr";\nexport const Foo = 1;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    // Count the import statements (not the call site reference) to assert dedup.
    const importOccurrences = (result!.code.match(/import\s+\{[^}]*__dolla_apply[^}]*\}\s+from/g) ?? []).length;
    expect(importOccurrences).toBe(1);
  });

  test("injects HMR self-accept for no-export files in dev (entry boundary)", () => {
    const result = runTransform(`const x = 1;\n`, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain('import { __dolla_apply, __dolla_export } from "@manyducks.co/dolla/hmr"');
    expect(result!.code).toContain("import.meta.hot.accept");
  });

  test("still returns null for no-export files in production build", () => {
    const result = runTransform(`const x = 1;\n`, "/abs/file.tsx", "build");
    expect(result).toBeNull();
  });

  test("makes the entry module a self-accept boundary (export let without initializer)", () => {
    // The app entry exports `export let appContext;` which has no `=`/`:`, so
    // it is not rewritten into a live-binding proxy — but it must still receive
    // an `import.meta.hot.accept` so an HMR update to a deeply-nested
    // dependency is contained here instead of bubbling to a full reload.
    const code = `export let appContext;\nconst root = createRoot("#app");\n`;
    const result = runTransform(code, "/abs/app.tsx", "serve");
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
    const result = runTransform(code, "/abs/views/TaskModal/TaskModal.tsx", "serve");
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
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toMatch(/__dolla_apply\(newModule, \{ Loader \}\)/);
    expect(result!.code).toContain("\nasync function Loader()");
    expect(result!.code).toContain(`Loader = __dolla_export("/abs/file.tsx:Loader", Loader);`);
    expect(result!.code).toContain("export { Loader };");
  });

  test("registers `export default async function Name` for HMR", () => {
    const code = `export default async function Page() { return null; }\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toMatch(/__dolla_apply\(newModule, \{ default: Page \}\)/);
  });

  test("returns null for files inside node_modules", () => {
    const result = runTransform(`export const Foo = 1;\n`, "/abs/project/node_modules/pkg/file.tsx", "serve");
    expect(result).toBeNull();
  });

  test("returns null for non-JS extensions", () => {
    const result = runTransform(`export const Foo = 1;\n`, "/abs/file.css", "serve");
    expect(result).toBeNull();
  });

  test("still injects HMR in production build", () => {
    const result = runTransform(`export const Foo = 1;\n`, "/abs/file.tsx", "build");
    expect(result).not.toBeNull();
    expect(result!.code).toContain("import.meta.hot.accept");
  });
});

describe("dollaPlugin — styled namer (dev only)", () => {
  const IMPORT = `import { styled } from "@manyducks.co/dolla/styled";\n`;

  test("injects .named(\"IDENT\") for const-styled intrinsic", () => {
    const code = IMPORT + `const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.button.named("MyButton")`);
  });

  test("handles export const", () => {
    const code = IMPORT + `export const PageContainer = styled.div\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("PageContainer")`);
  });

  test("handles styled(<View>) wrapping", () => {
    const code = IMPORT + `const MyLink = styled(MyButton)\`\n  color: blue;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled(MyButton).named("MyLink")`);
  });

  test("handles styled('custom-thing') string tag", () => {
    const code = IMPORT + `const Thing = styled("my-thing")\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled("my-thing").named("Thing")`);
  });

  test("handles styled['box'] bracket tag", () => {
    const code = IMPORT + `const Box = styled["box"]\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled["box"].named("Box")`);
  });

  test("injects .named AFTER existing .as(\"tag\") chain (orthogonal)", () => {
    const code = IMPORT + `const MyLink = styled.button.as("a")\`\n  color: blue;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.button.as("a").named("MyLink")`);
  });

  test("skips injection if .named already in chain (idempotency)", () => {
    const code = IMPORT + `export const X = styled.button.named("Already")\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    // The existing .named("Already") should remain; no second .named injected.
    expect(result!.code).toContain(`.named("Already")`);
    expect((result!.code.match(/\.named\(/g) ?? []).length).toBe(1);
  });

  test("does not rewrite destructuring assignments", () => {
    const code = IMPORT + `const { Foo } = styled;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    // No styled declaration to rewrite, but HMR self-accept is still injected.
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("does not rewrite function returns", () => {
    const code = IMPORT + `function make() { return styled.button\`\`; }\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    // No styled declaration to rewrite, but HMR self-accept is still injected.
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("rewrites multiple styled declarations in one file", () => {
    const code = IMPORT + [
      `const A = styled.div\`\n  color: red;\n\`;`,
      `const B = styled.span\`\n  color: blue;\n\`;`,
    ].join("\n");
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("A")`);
    expect(result!.code).toContain(`styled.span.named("B")`);
  });

  test("running transform twice is idempotent", () => {
    const code = IMPORT + `export const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const first = runTransform(code, "/abs/file.tsx", "serve");
    expect(first).not.toBeNull();
    const second = runTransform(first!.code, "/abs/file.tsx", "serve");
    expect(second).not.toBeNull();
    // Second pass should not double-inject .named.
    expect((second!.code.match(/\.named\(/g) ?? []).length).toBe(1);
  });

  test("does NOT inject .named in production build", () => {
    const code = IMPORT + `const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "build");
    // Either null or unmodified code (only HMR may have run for a no-export file).
    if (result == null) {
      expect(true).toBe(true);
    } else {
      expect(result.code).not.toContain(`.named("MyButton")`);
    }
  });

  test("handles multi-line template literals", () => {
    const code = IMPORT + `const X = styled.div\`
      color: red;
      background: white;
      padding: 4px;
    \`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("X")`);
  });

  test("skips styled inside an existing string literal", () => {
    const code = IMPORT + `const s = "styled.button";\nconst X = styled.div\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("X")`);
    // The string-literal occurrence should not be touched.
    expect(result!.code).toContain(`"styled.button";`);
  });

  test("does not rewrite a `styled` imported from another library", () => {
    const code = `import styled from "@emotion/styled";\nconst Title = styled.h1\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("does not rewrite `styled` when no import of it exists", () => {
    const code = `const Title = styled.h1\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).not.toContain(".named(");
  });

  test("does not rewrite member access like `theme.styled.span`", () => {
    const code = IMPORT + `const Label = theme.styled.span\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).not.toContain(".named(");
    expect(result!.code).toContain("theme.styled.span`");
  });

  test("does not borrow the name of an unrelated earlier const", () => {
    const code = IMPORT + `const theme = { color: "red" };\nfunction make() { return styled.button\`color: red;\`; }\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).not.toContain(".named(");
  });

  test("does not borrow a const name across an intervening expression", () => {
    const code = IMPORT + `const Wrapped = wrap(styled.div\`color: red;\`);\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).not.toContain(".named(");
  });

  test("names declarations in large files without rescanning the whole prefix", () => {
    const lines: string[] = [];
    for (let n = 0; n < 8000; n++) {
      lines.push(`const S${n} = styled.div\`color: red;\`;`);
    }
    const code = IMPORT + lines.join("\n") + "\n";
    const start = performance.now();
    const result = runTransform(code, "/abs/file.tsx", "serve");
    const elapsed = performance.now() - start;
    expect(result!.code).toContain(`const S0 = styled.div.named("S0")`);
    expect(result!.code).toContain(`const S7999 = styled.div.named("S7999")`);
    expect(elapsed).toBeLessThan(1000);
  });

  test("handles template literals with `${}` inside the chain arguments", () => {
    const code = IMPORT + "const Thing = styled.button.as(`${tag}`)`color: red;`;\n";
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain('styled.button.as(`${tag}`).named("Thing")`color: red;`');
  });

  test("handles `${}` containing braces inside the chain arguments", () => {
    const code = IMPORT + "const Thing = styled(make(`${ { a: '}' }.a }`))`color: red;`;\n";
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain(".named(\"Thing\")`color: red;`");
  });

  test("rewrites an aliased dolla styled import", () => {
    const code = `import { styled as s } from "@manyducks.co/dolla/styled";\nconst Title = s.h1\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain(`s.h1.named("Title")`);
  });
});

describe("dollaPlugin — export detection ignores non-code", () => {
  test("ignores `export function` inside a block comment", () => {
    const code = `/**\n * Usage:\n * export function MyView() {}\n */\nexport const Real = () => null;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain("MyView =");
    expect(result!.code).not.toContain("export { MyView }");
    expect(result!.code).toContain(" * export function MyView() {}");
    expect(result!.code).not.toMatch(/__dolla_apply\(newModule, \{[^}]*MyView/);
  });

  test("ignores `export function` inside a line comment", () => {
    const code = `// export function MyView() {}\nexport const Real = 1;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).not.toContain("MyView =");
    expect(result!.code).toContain("// export function MyView() {}");
  });

  test("does not rewrite `export function` inside a template literal", () => {
    const code = "export const snippet = `export function Demo() {}`;\n";
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain("`export function Demo() {}`");
    expect(result!.code).not.toContain("Demo =");
  });

  test("does not rewrite `export function` inside a string literal", () => {
    const code = `export const snippet = "export function Demo() {}";\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain(`"export function Demo() {}"`);
    expect(result!.code).not.toContain("Demo =");
  });

  test("does not hoist exports nested inside a namespace", () => {
    const code = `export namespace NS {\n  export function helper() {}\n}\nexport function Top() {}\n`;
    const result = runTransform(code, "/abs/file.ts", "serve");
    expect(result!.code).toContain("  export function helper() {}");
    expect(result!.code).not.toContain("helper =");
    expect(result!.code).toContain(`Top = __dolla_export("/abs/file.ts:Top", Top);`);
    expect(result!.code).toContain("export { Top };");
  });

  test("still rewrites a top-level export after a template literal with an expression", () => {
    const code = "const a = `x ${{ b: 1 }.b} y`;\nexport function After() {}\n";
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain(`After = __dolla_export("/abs/file.tsx:After", After);`);
  });

  test("a regex literal containing a quote does not hide later exports", () => {
    const code = `const re = /["']/g;\nexport function After() {}\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result!.code).toContain(`After = __dolla_export("/abs/file.tsx:After", After);`);
  });
});
