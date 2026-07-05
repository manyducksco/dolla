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
    expect(result!.code).toContain('import { __dolla_apply } from "@manyducks.co/dolla/hmr"');
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

  test("returns null for files with no exports", () => {
    const result = runTransform(`const x = 1;\n`, "/abs/file.tsx", "serve");
    expect(result).toBeNull();
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
    expect(result).toBeNull();
  });

  test("does not rewrite function returns", () => {
    const code = `function make() { return styled.button\`\`; }\n`;
    const result = runTransform(code, "/abs/file.tsx", "serve");
    expect(result).toBeNull();
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
