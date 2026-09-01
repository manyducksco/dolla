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
  test("injects .named(\"IDENT\") for const-styled intrinsic", () => {
    const code = `const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.button.named("MyButton")`);
  });

  test("handles export const", () => {
    const code = `export const PageContainer = styled.div\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("PageContainer")`);
  });

  test("handles styled(<View>) wrapping", () => {
    const code = `const MyLink = styled(MyButton)\`\n  color: blue;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled(MyButton).named("MyLink")`);
  });

  test("handles styled('custom-thing') string tag", () => {
    const code = `const Thing = styled("my-thing")\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled("my-thing").named("Thing")`);
  });

  test("handles styled['box'] bracket tag", () => {
    const code = `const Box = styled["box"]\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled["box"].named("Box")`);
  });

  test("injects .named AFTER existing .as(\"tag\") chain (orthogonal)", () => {
    const code = `const MyLink = styled.button.as("a")\`\n  color: blue;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.button.as("a").named("MyLink")`);
  });

  test("skips injection if .named already in chain (idempotency)", () => {
    const code = `export const X = styled.button.named("Already")\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    // The existing .named("Already") should remain; no second .named injected.
    expect(result!.code).toContain(`.named("Already")`);
    expect((result!.code.match(/\.named\(/g) ?? []).length).toBe(1);
  });

  test("does not rewrite destructuring assignments", () => {
    const code = `const { Foo } = styled;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    // No styled declaration to rewrite, but HMR self-accept is still injected.
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("does not rewrite function returns", () => {
    const code = `function make() { return styled.button\`\`; }\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    // No styled declaration to rewrite, but HMR self-accept is still injected.
    expect(result).not.toBeNull();
    expect(result!.code).not.toContain(".named(");
  });

  test("rewrites multiple styled declarations in one file", () => {
    const code = [
      `const A = styled.div\`\n  color: red;\n\`;`,
      `const B = styled.span\`\n  color: blue;\n\`;`,
    ].join("\n");
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("A")`);
    expect(result!.code).toContain(`styled.span.named("B")`);
  });

  test("running transform twice is idempotent", () => {
    const code = `export const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const first = runTransform(code, "/abs/file.tsx", "serve");
    expect(first).not.toBeNull();
    const second = runTransform(first!.code, "/abs/file.tsx", "serve");
    expect(second).not.toBeNull();
    // Second pass should not double-inject .named.
    expect((second!.code.match(/\.named\(/g) ?? []).length).toBe(1);
  });

  test("does NOT inject .named in production build", () => {
    const code = `const MyButton = styled.button\`\n  color: red;\n\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "build");
    // Either null or unmodified code (only HMR may have run for a no-export file).
    if (result == null) {
      expect(true).toBe(true);
    } else {
      expect(result.code).not.toContain(`.named("MyButton")`);
    }
  });

  test("handles multi-line template literals", () => {
    const code = `const X = styled.div\`
      color: red;
      background: white;
      padding: 4px;
    \`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("X")`);
  });

  test("skips styled inside an existing string literal", () => {
    const code = `const s = "styled.button";\nconst X = styled.div\`color: red;\`;\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`styled.div.named("X")`);
    // The string-literal occurrence should not be touched.
    expect(result!.code).toContain(`"styled.button";`);
  });
});
