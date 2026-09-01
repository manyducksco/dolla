import MagicString from "magic-string";

const HMR_IMPORT = 'import { __dolla_apply, __dolla_export } from "@manyducks.co/dolla/hmr"';
const HMR_IMPORT_RE = /import\s+.*__dolla_(?:apply|export).*from\s+["']@manyducks\.co\/dolla\/hmr["']/;
const HMR_ACCEPT_RE = /import\.meta\.hot\.accept\s*\(/;

// Match `export function Foo` — NOT `export default function`
const EXPORT_FUNC_RE = /export\s+function\s+\*?\s*([a-zA-Z_$]\w*)/g;

// Match `export const Foo =`
const EXPORT_CONST_RE = /export\s+(?:const|let|var)\s+([a-zA-Z_$]\w*)\s*[=:]/g;

// Match `export default function Foo` or `export default function`
const EXPORT_DEFAULT_FUNC_RE = /export\s+default\s+function\s+\*?\s*([a-zA-Z_$]\w*)?\s*\(/;

// Match `export default Foo` (identifier reference, e.g. re-export)
const EXPORT_DEFAULT_IDENT_RE = /export\s+default\s+([a-zA-Z_$]\w*)\s*;?$/m;

// Match `const|let|var IDENT =` (optionally preceded by `export`).
// Captures the identifier name in group 1. The trailing `(?=[\s=])` keeps the
// boundary check anchored without consuming the assignment operator.
const DECLARATOR_RE = /(?:\b|^)(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?=[=])/g;

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

/*============================*\
||     Styled-Namer Scanner   ||
\*============================*/

/**
 * Walks a snippet of source text starting right after a `styled` token and
 * returns the position of the opening backtick of a tagged-template literal,
 * along with the text of any `.method(...)` chain sitting between the
 * styled-expression end and that backtick. Returns `null` if the snippet
 * does not lead to a tagged template.
 *
 * Skips over string literals (single, double, backtick), line and block
 * comments, and balanced parens.
 */
function scanStyledChain(code, startOffset) {
  // First, the `styled` base expression. This is exactly ONE of:
  // `.ident`, `["ident"]`, or `(arg)`. We do not consume additional method
  // calls in the base — those are part of the chain.
  let i = startOffset;
  i = skipSpaceAndComments(code, i);

  if (code[i] === ".") {
    i++;
    if (!/[A-Za-z_$]/.test(code[i])) return null;
    while (i < code.length && /[\w$]/.test(code[i])) i++;
  } else if (code[i] === "[" && code[i + 1] === '"') {
    const close = code.indexOf('"]', i + 2);
    if (close === -1) return null;
    i = close + 2;
  } else if (code[i] === "(") {
    const end = matchParenBalance(code, i);
    if (end === -1) return null;
    i = end;
  } else {
    return null;
  }

  i = skipSpaceAndComments(code, i);

  // Now scan zero or more `.method(args)` chain calls.
  const chainStart = i;
  while (code[i] === ".") {
    i++;
    if (!/[A-Za-z_$]/.test(code[i])) return null;
    while (i < code.length && /[\w$]/.test(code[i])) i++;
    if (code[i] !== "(") return null;
    const end = matchParenBalance(code, i);
    if (end === -1) return null;
    i = end;
    i = skipSpaceAndComments(code, i);
  }
  const chainEnd = i;
  const chainText = code.slice(chainStart, chainEnd);

  if (code[i] !== "`") return null;
  return { backtick: i, chainText, baseEnd: chainStart };
}

function skipSpaceAndComments(code, i) {
  while (i < code.length) {
    const c = code[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
    } else if (c === "/" && code[i + 1] === "/") {
      i += 2;
      while (i < code.length && code[i] !== "\n") i++;
    } else if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
    } else {
      break;
    }
  }
  return i;
}

function matchParenBalance(code, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      const step = skipString(code, i);
      if (step === -1) return -1;
      i = step;
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      i += 2;
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1;
}

function matchAngleBalance(code, openIndex) {
  // Treat `<...>` for type-arg balancing. Track paren depth so `<T, (() => number)>` works.
  let depth = 0;
  let i = openIndex;
  let parenDepth = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      const step = skipString(code, i);
      if (step === -1) return -1;
      i = step;
      continue;
    }
    if (c === "(") parenDepth++;
    else if (c === ")") parenDepth--;
    else if (parenDepth === 0) {
      if (c === "<") depth++;
      else if (c === ">") {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
    i++;
  }
  return -1;
}

function skipString(code, startIndex) {
  const quote = code[startIndex];
  let i = startIndex + 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (quote === "`" && c === "$" && code[i + 1] === "{") {
      const end = matchParenBalance(code, i + 1);
      if (end === -1) return -1;
      i = end;
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  return -1;
}

/**
 * Finds all `styled` declarations in the source and rewrites them to
 * `styled(...).named("IDENT")` so the CSS className is debug-friendly in
 * dev. Skips chains that already call `.named(...)` (idempotency) and
 * declarations whose LHS isn't a plain identifier.
 */
function applyStyledNamer(s, code) {
  let matched = false;

  // Find every `styled` keyword at a word boundary.
  for (let i = 0; i < code.length; i++) {
    if (code[i] !== "s" || code.slice(i, i + 6) !== "styled") continue;
    // Word boundary check on the left.
    const prev = i > 0 ? code[i - 1] : "";
    if (/[\w$]/.test(prev)) continue;
    // The char after `styled` must be one of: `.`, `[`, `(`, `<`, or whitespace.
    const next = code[i + 6] ?? "";
    if (!/[.\[(\s<]/.test(next) && next !== "<") continue;
    // Skip if this is a member access on something else (e.g. `obj.styled`).
    // We rely on the left boundary check above; if it passed, we're clear.

    const scan = scanStyledChain(code, i + 6);
    if (!scan) continue;

    // Look backward for the enclosing declarator. We need a simple
    // `const|let|var IDENT =` (optionally preceded by `export`).
    const lhsEnd = i; // i is the start of `styled`
    const before = code.slice(0, lhsEnd);

    // Use a non-greedy regex that finds the most recent declarator ending at
    // or just before `styled`. We scan with global but pick the last match.
    DECLARATOR_RE.lastIndex = 0;
    let lastMatch = null;
    let m;
    while ((m = DECLARATOR_RE.exec(before)) !== null) {
      // Ensure the declarator is at top level (ignoring balanced parens, but
      // we don't actually need that here — destructuring or function returns
      // would put parens/braces between, which DECLARATOR_RE wouldn't match).
      lastMatch = m;
    }
    if (!lastMatch) continue;

    const ident = lastMatch[1];

    // Idempotency: if the chain already contains `.named(`, skip.
    if (/\.named\s*\(/.test(scan.chainText)) continue;

    s.appendLeft(scan.backtick, `.named(${JSON.stringify(ident)})`);
    matched = true;
    // Skip past the backtick to continue scanning.
    i = scan.backtick;
  }

  return matched;
}

/*============================*\
||   Live-Binding Rewriter   ||
\*============================*/

/**
 * Rewrites `export function Foo` into `function Foo` (local) and appends
 * `Foo = __dolla_export("<id>:Foo", Foo); export { Foo };` at the bottom.
 * Skips `export default function` (handled separately).
 */
function applyLiveBindings(s, code, id, entries) {
  // Only wrap named-function exports. Skips default, const, etc.
  const EXPORT_NAMED_FUNC_RE = /export\s+function\s+\*?\s*([a-zA-Z_$]\w*)/g;

  const seen = new Set();
  const names = [];
  let match;

  EXPORT_NAMED_FUNC_RE.lastIndex = 0;
  while ((match = EXPORT_NAMED_FUNC_RE.exec(code)) !== null) {
    const name = match[1];
    const exportStart = match.index;

    // Remove `export ` (7 chars). The regex guarantees they are there.
    s.remove(exportStart, exportStart + 7);

    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  if (names.length === 0) return false;

  let block = "";
  for (const name of names) {
    const strId = JSON.stringify(`${id}:${name}`);
    block += `\n${name} = __dolla_export(${strId}, ${name});`;
  }
  block += `\nexport { ${names.join(", ")} };\n`;

  s.appendRight(code.length, block);
  return true;
}

/*============================*\
||         Plugin Default     ||
\*============================*/

export default function dollaPlugin() {
  return {
    name: "dolla",
    enforce: "pre",
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id)) return null;
      if (id.includes("node_modules")) return null;

      const isDev =
        this.environment?.command === "serve" ||
        this.environment?.config?.command === "serve" ||
        this.config?.command === "serve";
      const hasStyled = isDev && code.includes("styled");

      // In a production build, only transform files that can actually change
      // app behavior (have exports or `styled`). In dev we process every file
      // so that even the entry module (which may have no matching exports) gets
      // an `import.meta.hot.accept` self-accept boundary — that contains HMR
      // cascades and prevents a full-reload re-mount of the whole app.
      if (!isDev && !code.match(/\bexport\b/) && !code.includes("styled")) return null;

      const s = new MagicString(code);
      let edited = false;

      // HMR injection (dev + build).
      const entries = findExportEntries(code);

      // Inject `import.meta.hot.accept` into EVERY module that participates in
      // the HMR graph — including the entry module, which may have no matching
      // exports. Without a self-accept handler on the entry, an update to a
      // deeply-nested dependency bubbles all the way up and Vite falls through
      // to a full reload of the entry. Re-mounting the whole app on every
      // nested edit re-mounts the current route and duplicates its DOM in
      // #app. Making each module a boundary contains the update so it resolves
      // via the in-place `replaceView` path instead.
      const needsAccept = isDev || entries.length > 0;

      // Register the self-accept boundary at the VERY TOP of the module, before
      // any other top-level code. A heavy view module (many imports, styled
      // components) can throw during Vite's HMR re-evaluation (circular-import /
      // re-eval ordering is the usual cause); if the boundary were appended at
      // the bottom it would never register, Vite would treat the module as
      // non-self-accepting, and the update would bubble to a full page reload —
      // which re-mounts the whole app and duplicates the current route in #app.
      // Placing it at the top guarantees registration regardless of any later
      // throw during re-evaluation. The callback closes over `entries`, which
      // are in lexical scope and defined by the time Vite actually invokes it.
      if (needsAccept && !HMR_ACCEPT_RE.test(code)) {
        const hmrCall = `if (import.meta.hot) { import.meta.hot.accept((newModule) => { __dolla_apply(newModule, { ${entries.join(", ")} }); }); }\n`;
        if (!HMR_IMPORT_RE.test(code)) {
          s.appendLeft(0, HMR_IMPORT + ";\n" + hmrCall);
        } else {
          s.appendLeft(0, hmrCall);
        }
      }
      // Mark as edited whenever we participate in the HMR graph so an
      // idempotent re-transform still returns the (unchanged) code rather
      // than null.
      if (needsAccept) edited = true;

      // Live-binding: wrap named function exports in a stable proxy for HMR (dev only).
      // Must run before the HMR call so the proxy is assigned before the callback captures it.
      const liveBound = isDev && entries.length > 0 && applyLiveBindings(s, code, id, entries);

      // Styled-namer (dev only).
      if (hasStyled) {
        if (applyStyledNamer(s, code)) {
          edited = true;
        }
      }

      if (!edited) return null;
      return { code: s.toString(), map: s.generateMap({ hires: true }) };
    },
  };
}
