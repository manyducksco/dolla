import MagicString from "magic-string";

const HMR_IMPORT = 'import { __dolla_apply, __dolla_export } from "@manyducks.co/dolla/hmr"';
const HMR_IMPORT_RE = /import\s+.*__dolla_(?:apply|export).*from\s+["']@manyducks\.co\/dolla\/hmr["']/;
const HMR_ACCEPT_RE = /import\.meta\.hot\.accept\s*\(/;

// Match `export function Foo` — NOT `export default function`
const EXPORT_FUNC_RE = /export\s+(?:async\s+)?function\s+\*?\s*([a-zA-Z_$]\w*)/g;

// Match `export const Foo =`
const EXPORT_CONST_RE = /export\s+(?:const|let|var)\s+([a-zA-Z_$]\w*)\s*[=:]/g;

// Match `export default function Foo` or `export default function`
const EXPORT_DEFAULT_FUNC_RE = /export\s+default\s+(?:async\s+)?function\s+\*?\s*([a-zA-Z_$]\w*)?\s*\(/g;

// Match `export default Foo` (identifier reference, e.g. re-export)
const EXPORT_DEFAULT_IDENT_RE = /export\s+default\s+([a-zA-Z_$]\w*)\s*;?$/gm;

// Match `const|let|var IDENT =` ending at the end of the input, i.e. a
// declarator whose initializer starts right after. Captures the identifier
// name in group 1.
const DECLARATOR_RE = /(?:^|[^\w$.])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/;
const DECLARATOR_WINDOW = 256;

/*============================*\
||        Code Masking        ||
\*============================*/

const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "case",
  "do",
  "else",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "yield",
  "await",
]);

/**
 * Returns a copy of `code` with the contents of comments, string literals,
 * template literal text and regex literals replaced by spaces (newlines are
 * kept), so regexes run against it only ever match real code. Positions are
 * unchanged, so match indices can be used against the original source.
 *
 * Also returns `depth`, where `depth[i]` is the curly-brace nesting depth at
 * position `i` (0 = top level of the module).
 *
 * This is a lightweight lexer, not a parser. It handles the cases that
 * matter for export detection; ambiguities (e.g. `/` as division vs. regex,
 * apostrophes in JSX text) are resolved so that a mistake can only affect
 * the rest of the current line.
 */
function maskNonCode(code) {
  const out = code.split("");
  const depth = new Int32Array(code.length + 1);
  const len = code.length;
  // Stack of brace depths at which an open template literal `${` resumes.
  const templateStack = [];
  let braces = 0;
  let i = 0;
  // Last significant code character / word, used to tell regex from division.
  let lastChar = "";
  let lastWord = "";

  const blank = (from, to) => {
    for (let k = from; k < to && k < len; k++) {
      if (out[k] !== "\n" && out[k] !== "\r") out[k] = " ";
      depth[k] = braces;
    }
  };

  // Scans template text starting at `i` (just after a backtick or a closing
  // `}` of an expression). Returns the index to resume code scanning at.
  const scanTemplate = (start) => {
    let j = start;
    while (j < len) {
      const c = code[j];
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "`") {
        blank(start, j);
        depth[j] = braces;
        return j + 1;
      }
      if (c === "$" && code[j + 1] === "{") {
        blank(start, j);
        depth[j] = braces;
        templateStack.push(braces);
        braces++;
        depth[j + 1] = braces;
        return j + 2;
      }
      j++;
    }
    blank(start, len);
    return len;
  };

  while (i < len) {
    const c = code[i];
    depth[i] = braces;

    if (c === "/" && code[i + 1] === "/") {
      let j = i;
      while (j < len && code[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i + 2);
      const j = end === -1 ? len : end + 2;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      // Plain strings can't span lines (without a trailing backslash). If one
      // runs into a newline it was probably an apostrophe in JSX text, so
      // treat the quote as an ordinary character.
      let j = i + 1;
      while (j < len && code[j] !== c && code[j] !== "\n") {
        j += code[j] === "\\" ? 2 : 1;
      }
      if (j < len && code[j] === c) {
        blank(i + 1, j);
        depth[j] = braces;
        i = j + 1;
        lastChar = c;
        lastWord = "";
        continue;
      }
      i++;
      lastChar = c;
      continue;
    }
    if (c === "`") {
      i = scanTemplate(i + 1);
      lastChar = "`";
      lastWord = "";
      continue;
    }
    if (c === "/") {
      // `</` is a JSX closing tag, not a regex.
      const regexAllowed =
        lastChar === "" || /[(,=:[!&|?{};+\-*%>~^]/.test(lastChar) || REGEX_PRECEDING_KEYWORDS.has(lastWord);
      if (regexAllowed) {
        let j = i + 1;
        let inClass = false;
        while (j < len && code[j] !== "\n") {
          const r = code[j];
          if (r === "\\") {
            j += 2;
            continue;
          }
          if (r === "[") inClass = true;
          else if (r === "]") inClass = false;
          else if (r === "/" && !inClass) break;
          j++;
        }
        if (j < len && code[j] === "/") {
          blank(i + 1, j);
          depth[j] = braces;
          i = j + 1;
          lastChar = "/";
          lastWord = "";
          continue;
        }
      }
      i++;
      lastChar = "/";
      lastWord = "";
      continue;
    }
    if (c === "{") {
      braces++;
    } else if (c === "}") {
      if (templateStack.length > 0 && templateStack[templateStack.length - 1] === braces - 1) {
        templateStack.pop();
        braces--;
        depth[i] = braces;
        i = scanTemplate(i + 1);
        lastChar = "`";
        lastWord = "";
        continue;
      }
      braces = Math.max(0, braces - 1);
      depth[i] = braces;
    }

    if (/[\w$]/.test(c)) {
      let j = i;
      while (j < len && /[\w$]/.test(code[j])) {
        depth[j] = braces;
        j++;
      }
      lastWord = code.slice(i, j);
      lastChar = code[j - 1];
      i = j;
      continue;
    }
    if (!/\s/.test(c)) {
      lastChar = c;
      lastWord = "";
    }
    i++;
  }
  depth[len] = braces;

  return { masked: out.join(""), depth };
}

/**
 * Runs a global regex against masked source and yields only the matches that
 * start at the top level of the module.
 */
function* topLevelMatches(re, scan) {
  re.lastIndex = 0;
  let match;
  while ((match = re.exec(scan.masked)) !== null) {
    if (scan.depth[match.index] === 0) yield match;
  }
}

function findExportEntries(code, scan = maskNonCode(code), isDev = false) {
  const entries = [];

  for (const match of topLevelMatches(EXPORT_FUNC_RE, scan)) {
    entries.push(match[1]);
  }

  for (const match of topLevelMatches(EXPORT_CONST_RE, scan)) {
    entries.push(match[1]);
  }

  for (const match of topLevelMatches(EXPORT_DEFAULT_FUNC_RE, scan)) {
    // In dev an anonymous default function is named by `applyLiveBindings`.
    const name = match[1] ?? (isDev ? ANONYMOUS_DEFAULT : undefined);
    if (name) {
      entries.push(`default: ${name}`);
    }
    return entries;
  }

  for (const match of topLevelMatches(EXPORT_DEFAULT_IDENT_RE, scan)) {
    entries.push(`default: ${match[1]}`);
    break;
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

/**
 * Returns the index just past the bracket that closes the one at `openIndex`
 * (`(` by default), skipping strings and comments. Returns -1 if unbalanced.
 */
function matchParenBalance(code, openIndex, open = "(", close = ")") {
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
    if (c === open) depth++;
    else if (c === close) {
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
      const end = matchParenBalance(code, i + 1, "{", "}");
      if (end === -1) return -1;
      i = end;
      continue;
    }
    if (c === quote) return i + 1;
    i++;
  }
  return -1;
}

const DOLLA_STYLED_IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*["']@manyducks\.co\/dolla\/styled["']/g;

function escapeRegExp(text) {
  return text.replace(/\$/g, "\\$");
}

/**
 * Returns the local names that `styled` from `@manyducks.co/dolla/styled` is
 * bound to in this module (usually just `["styled"]`).
 */
function findDollaStyledImports(code, codeScan) {
  const names = [];
  DOLLA_STYLED_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = DOLLA_STYLED_IMPORT_RE.exec(code)) !== null) {
    // Ignore matches inside comments or strings.
    if (codeScan.masked.slice(match.index, match.index + 6) !== "import") continue;
    for (const spec of match[1].split(",")) {
      const m = /^\s*styled(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(spec);
      if (m) names.push(m[1] ?? "styled");
    }
  }
  return names;
}

/**
 * Finds all `styled` declarations in the source and rewrites them to
 * `styled(...).named("IDENT")` so the CSS className is debug-friendly in
 * dev. Skips chains that already call `.named(...)` (idempotency) and
 * declarations whose LHS isn't a plain identifier.
 */
function applyStyledNamer(s, code, codeScan = maskNonCode(code)) {
  let matched = false;
  const masked = codeScan.masked;

  // Only rewrite the `styled` exported by dolla. Other libraries also export
  // a `styled` (e.g. `@emotion/styled`) whose components must be left alone.
  const localNames = findDollaStyledImports(code, codeScan);
  if (localNames.length === 0) return false;

  // Search the masked source so occurrences in comments/strings are skipped.
  const nameRe = new RegExp(`(?<![\\w$])(?:${localNames.map(escapeRegExp).join("|")})(?![\\w$])`, "g");
  let found;
  while ((found = nameRe.exec(masked)) !== null) {
    const i = found.index;
    const nameEnd = i + found[0].length;
    // Skip member access on something else (e.g. `theme.styled`).
    let p = i - 1;
    while (p >= 0 && /\s/.test(masked[p])) p--;
    if (p >= 0 && masked[p] === ".") continue;

    const scan = scanStyledChain(code, nameEnd);
    if (!scan) continue;

    // The `styled` expression must be the direct initializer of a simple
    // `const|let|var IDENT =` declarator. Only look at a short window right
    // before it (masked, so comments in between are whitespace).
    const declMatch = DECLARATOR_RE.exec(masked.slice(Math.max(0, i - DECLARATOR_WINDOW), i));
    if (!declMatch) continue;

    const ident = declMatch[1];

    // Idempotency: if the chain already contains `.named(`, skip.
    if (/\.named\s*\(/.test(scan.chainText)) continue;

    s.appendLeft(scan.backtick, `.named(${JSON.stringify(ident)})`);
    matched = true;
    // Skip past the backtick to continue scanning.
    nameRe.lastIndex = scan.backtick;
  }

  return matched;
}

/*============================*\
||   Live-Binding Rewriter   ||
\*============================*/

/**
 * Local name given to an anonymous `export default function` so it can be
 * wrapped like a named one.
 */
const ANONYMOUS_DEFAULT = "__dolla_default";

const EXPORT_CONST_DECL_RE = /export\s+const\s+([a-zA-Z_$][\w$]*)/g;
const STATEMENT_START_RE = /^(?:export|import|const|let|var|function|class|async|if|for|while|do|switch|try|return|throw)\b/;

/**
 * Returns the index of the `=` that starts a declaration's initializer, given
 * the index just after the declared name. Skips a TypeScript type annotation
 * (which may contain `=>`). Returns -1 if there is no initializer.
 */
function findInitializer(code, scan, i) {
  i = skipSpaceAndComments(code, i);
  if (code[i] === "=" && code[i + 1] !== "=") return i;
  if (code[i] !== ":") return -1;

  let depth = 0;
  for (i++; i < code.length; i++) {
    const c = scan.masked[i];
    if (c === "=" && code[i + 1] === ">") {
      i++; // `=>` inside a function type
    } else if (c === "(" || c === "[" || c === "{" || c === "<") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}" || c === ">") {
      depth--;
    } else if (depth === 0 && c === "=") {
      return i;
    } else if (depth === 0 && c === ";") {
      return -1;
    }
  }
  return -1;
}

/**
 * Returns true if the expression starting after the `=` at `eq` is a function
 * or arrow function literal. Anything else (classes, calls, styled components,
 * other values) is left alone, because the HMR wrapper is a plain function and
 * would hide their properties or break `new`.
 */
function isFunctionInitializer(code, scan, eq) {
  let i = skipSpaceAndComments(code, eq + 1);

  if (/^async\b/.test(code.slice(i, i + 6))) {
    const next = skipSpaceAndComments(code, i + 5);
    // `async => ...` is an arrow whose parameter is named "async".
    if (!code.startsWith("=>", next)) i = next;
  }
  if (/^function\b/.test(code.slice(i, i + 9))) return true;

  if (code[i] === "<") {
    const end = matchAngleBalance(code, i);
    if (end === -1) return false;
    i = skipSpaceAndComments(code, end);
  }

  if (code[i] === "(") {
    const end = matchParenBalance(code, i);
    if (end === -1) return false;
    i = skipSpaceAndComments(code, end);
    if (code.startsWith("=>", i)) return true;
    if (code[i] !== ":") return false;

    // Return type annotation: look for the arrow at depth 0.
    let depth = 0;
    for (i++; i < code.length; i++) {
      const c = scan.masked[i];
      if (c === "=" && code[i + 1] === ">") {
        if (depth === 0) return true;
        i++;
      } else if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
      else if (c === ")" || c === "]" || c === "}" || c === ">") depth--;
      else if (depth === 0 && (c === ";" || c === "=" || c === ",")) return false;
    }
    return false;
  }

  return /^[A-Za-z_$][\w$]*\s*=>/.test(code.slice(i, i + 256));
}

/**
 * Returns true if the declaration whose initializer starts at `eq` declares
 * more than one name (`const a = ..., b = ...`). Stops at the end of the
 * statement; when unsure it reports more than one, so nothing is wrapped.
 */
function hasMoreDeclarators(code, scan, eq) {
  let start = skipSpaceAndComments(code, eq + 1);
  // Skip a generic arrow's type parameters, e.g. the comma in `<T,>(x: T) => x`.
  if (code[start] === "<") {
    start = matchAngleBalance(code, start);
    if (start === -1) return true;
  }

  let depth = 0;
  for (let i = start; i < code.length; i++) {
    const c = scan.masked[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (depth === 0 && c === ";") return false;
    else if (depth === 0 && c === ",") return true;
    else if (depth === 0 && c === "\n") {
      const next = skipSpaceAndComments(code, i);
      if (next >= code.length || STATEMENT_START_RE.test(code.slice(next, next + 8))) return false;
    }
  }
  return false;
}

/**
 * Rewrites exported functions so they are bound to a stable HMR wrapper, which
 * keeps their identity across hot reloads (stores rely on this):
 *
 * - `export function Foo` and `export const Foo = <function>` become local
 *   (`function Foo` / `let Foo`), followed at the bottom by
 *   `Foo = __dolla_export("<id>:Foo", Foo); export { Foo };`.
 * - `export default function [Name]` becomes a local function, followed by
 *   `Name = __dolla_export("<id>:default", Name); export { Name as default };`.
 *   An anonymous one is named `__dolla_default`.
 */
function applyLiveBindings(s, code, id, scan) {
  const EXPORT_NAMED_FUNC_RE = /export\s+(?:async\s+)?function\s+\*?\s*([a-zA-Z_$]\w*)/g;

  const seen = new Set();
  const names = [];
  let defaultName;

  for (const match of topLevelMatches(EXPORT_NAMED_FUNC_RE, scan)) {
    const name = match[1];
    const exportStart = match.index;

    // Remove `export ` (7 chars). The regex guarantees they are there.
    s.remove(exportStart, exportStart + 7);

    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  for (const match of topLevelMatches(EXPORT_CONST_DECL_RE, scan)) {
    const name = match[1];
    const eq = findInitializer(code, scan, match.index + match[0].length);
    if (eq === -1 || !isFunctionInitializer(code, scan, eq) || hasMoreDeclarators(code, scan, eq)) continue;

    // `export const Foo` -> `let Foo` so the wrapper can be assigned to it.
    const nameStart = match.index + match[0].length - name.length;
    s.overwrite(match.index, nameStart, "let ");

    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  for (const match of topLevelMatches(EXPORT_DEFAULT_FUNC_RE, scan)) {
    const functionStart = match.index + match[0].search(/(?:async\s+)?function\b/);
    s.remove(match.index, functionStart);

    defaultName = match[1];
    if (!defaultName) {
      // Name the anonymous function just before its parameter list.
      defaultName = ANONYMOUS_DEFAULT;
      s.appendLeft(match.index + match[0].length - 1, ` ${ANONYMOUS_DEFAULT}`);
    }
    break;
  }

  if (names.length === 0 && !defaultName) return false;

  let block = "";
  for (const name of names) {
    const strId = JSON.stringify(`${id}:${name}`);
    block += `\n${name} = __dolla_export(${strId}, ${name});`;
  }
  if (names.length) block += `\nexport { ${names.join(", ")} };`;
  if (defaultName) {
    block += `\n${defaultName} = __dolla_export(${JSON.stringify(`${id}:default`)}, ${defaultName});`;
    block += `\nexport { ${defaultName} as default };`;
  }

  s.appendRight(code.length, block + "\n");
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
      const scan = maskNonCode(code);
      const entries = findExportEntries(code, scan, isDev);

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
      const liveBound = isDev && entries.length > 0 && applyLiveBindings(s, code, id, scan);

      // Styled-namer (dev only).
      if (hasStyled) {
        if (applyStyledNamer(s, code, scan)) {
          edited = true;
        }
      }

      if (!edited) return null;
      return { code: s.toString(), map: s.generateMap({ source: id, includeContent: true, hires: true }) };
    },
  };
}
