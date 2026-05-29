const HMR_IMPORT = 'import { __dolla_apply } from "@manyducks.co/dolla/hmr"';
const HMR_IMPORT_RE = /import\s+.*__dolla_apply.*from\s+["']@manyducks\.co\/dolla\/hmr["']/;

// Match `export function Foo` — NOT `export default function`
const EXPORT_FUNC_RE = /export\s+function\s+\*?\s*([a-zA-Z_$]\w*)/g;

// Match `export const Foo =`
const EXPORT_CONST_RE = /export\s+(?:const|let|var)\s+([a-zA-Z_$]\w*)\s*[=:]/g;

// Match `export default function Foo` or `export default function`
const EXPORT_DEFAULT_FUNC_RE = /export\s+default\s+function\s+\*?\s*([a-zA-Z_$]\w*)?\s*\(/;

// Match `export default Foo` (identifier reference, e.g. re-export)
const EXPORT_DEFAULT_IDENT_RE = /export\s+default\s+([a-zA-Z_$]\w*)\s*;?$/m;

function findExportEntries(code) {
  const entries = [];
  let match;

  EXPORT_FUNC_RE.lastIndex = 0;
  while ((match = EXPORT_FUNC_RE.exec(code)) !== null) {
    entries.push(match[1]);
  }

  EXPORT_CONST_RE.lastIndex = 0;
  while ((match = EXPORT_CONST_RE.exec(code)) !== null) {
    entries.push(match[1]);
  }

  EXPORT_DEFAULT_FUNC_RE.lastIndex = 0;
  if ((match = EXPORT_DEFAULT_FUNC_RE.exec(code)) !== null) {
    const name = match[1];
    if (name) {
      entries.push(`default: ${name}`);
    }
    return entries;
  }

  EXPORT_DEFAULT_IDENT_RE.lastIndex = 0;
  if ((match = EXPORT_DEFAULT_IDENT_RE.exec(code)) !== null) {
    entries.push(`default: ${match[1]}`);
  }

  return entries;
}

export default function dollaHmrPlugin() {
  return {
    name: "dolla-hmr",
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id)) return null;
      if (id.includes("node_modules")) return null;

      const entries = findExportEntries(code);
      if (entries.length === 0) return null;

      let result = code;

      if (!HMR_IMPORT_RE.test(code)) {
        result = HMR_IMPORT + ";\n" + result;
      }

      const hmrCall = `\nif (import.meta.hot) { import.meta.hot.accept((newModule) => { __dolla_apply(newModule, { ${entries.join(", ")} }); }); }\n`;
      result += hmrCall;

      return result;
    },
  };
}
