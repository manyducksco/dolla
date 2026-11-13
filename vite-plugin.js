import MagicString from "magic-string";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const PACKAGE_NAME = "@manyducks.co/dolla";
const HMR_MODULE = `${PACKAGE_NAME}/hmr`;
const HMR_HELPERS = ["__dolla_apply", "__dolla_export", "__dolla_store"];
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

/**
 * Returns `[exported, local]` pairs for the module's exports that the HMR accept
 * callback passes to `__dolla_apply`, given the pairs `applyLiveBindings` wrapped.
 */
function findExportEntries(code, scan, wrappedPairs) {
  const entries = new Map();

  for (const match of topLevelMatches(EXPORT_FUNC_RE, scan)) {
    entries.set(match[1], match[1]);
  }

  for (const match of topLevelMatches(EXPORT_CONST_RE, scan)) {
    entries.set(match[1], match[1]);
  }

  for (const match of topLevelMatches(EXPORT_DEFAULT_IDENT_RE, scan)) {
    entries.set("default", match[1]);
    break;
  }

  // The wrapped exports, under the local names the rewritten module gives them.
  for (const [exported, local] of wrappedPairs) entries.set(exported, local);

  return [...entries];
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
  return { backtick: i, chainText };
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

function escapeRegExp(text) {
  return text.replace(/\$/g, "\\$");
}

/**
 * Returns the local names that the named export `name` of module `source` is
 * bound to by this module's `import { ... } from "<source>"` statements.
 */
function findNamedImports(code, codeScan, source, name) {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${source.replace(/[.\/]/g, "\\$&")}["']`, "g");
  const names = [];
  let match;
  while ((match = re.exec(code)) !== null) {
    // Ignore matches inside comments or strings.
    if (codeScan.masked.slice(match.index, match.index + 6) !== "import") continue;
    for (const spec of match[1].split(",")) {
      const m = /^\s*([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*$/.exec(spec);
      if (m && m[1] === name) names.push(m[2] ?? name);
    }
  }
  return names;
}

/**
 * Returns the local names that `styled` from `@manyducks.co/dolla/styled` is
 * bound to in this module (usually just `["styled"]`).
 */
function findDollaStyledImports(code, codeScan) {
  return findNamedImports(code, codeScan, "@manyducks.co/dolla/styled", "styled");
}

/**
 * Finds all `styled` declarations in the source and rewrites them to
 * `styled(...).named("IDENT")` so the CSS className is debug-friendly in
 * dev. Skips chains that already call `.named(...)` (idempotency) and
 * declarations whose LHS isn't a plain identifier.
 */
function applyStyledNamer(s, code, codeScan = maskNonCode(code)) {
  const masked = codeScan.masked;

  // Only rewrite the `styled` exported by dolla. Other libraries also export
  // a `styled` (e.g. `@emotion/styled`) whose components must be left alone.
  const localNames = findDollaStyledImports(code, codeScan);
  if (localNames.length === 0) return;

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
    // Skip past the backtick to continue scanning.
    nameRe.lastIndex = scan.backtick;
  }
}

/*============================*\
||     Hot CSS Templates      ||
\*============================*/

const HOT_CSS_IMPORT = 'import { __dolla_css } from "@manyducks.co/dolla/hmr";\n';
// Tokens that continue an expression onto the next line, so a newline after a template doesn't end it.
const CONTINUES_EXPRESSION_RE = /[.[(`?:+\-*/%&|^<>=!]/;

/**
 * Returns the local names that `css` from `@manyducks.co/dolla` is bound to in
 * this module (usually just `["css"]`).
 */
function findDollaCssImports(code, codeScan) {
  return findNamedImports(code, codeScan, "@manyducks.co/dolla", "css");
}

/** Returns true if the expression that ends at `end` is the whole initializer of its declarator. */
function endsInitializer(code, end) {
  const next = skipSpaceAndComments(code, end);
  if (next >= code.length || code[next] === ";" || code[next] === ",") return true;
  return code.slice(end, next).includes("\n") && !CONTINUES_EXPRESSION_RE.test(code[next]);
}

/**
 * Rewrites top-level `const|let Name = css\`...\`` declarations to
 * `const Name = __dolla_css("<id>:Name")\`...\``. Every version of the template is
 * then the same object with the same class name, so modules that imported it see
 * each update. Only templates that are the whole initializer are rewritten.
 * Returns true if anything was rewritten.
 */
function applyHotCss(s, code, id, scan) {
  const tags = findDollaCssImports(code, scan);
  if (tags.length === 0) return false;

  let rewritten = false;
  for (const match of topLevelMatches(LOCAL_DECL_RE, scan)) {
    const name = match[1];
    const eq = findInitializer(code, scan, match.index + match[0].length);
    if (eq === -1) continue;

    const start = skipSpaceAndComments(code, eq + 1);
    const tag = tags.find((t) => code.startsWith(t, start) && !/[\w$]/.test(code[start + t.length] ?? ""));
    if (!tag) continue;
    const backtick = skipSpaceAndComments(code, start + tag.length);
    if (code[backtick] !== "`") continue;
    const end = skipString(code, backtick);
    if (end === -1 || !endsInitializer(code, end)) continue;

    s.overwrite(start, start + tag.length, `__dolla_css(${JSON.stringify(`${id}:${name}`)})`);
    rewritten = true;
  }
  return rewritten;
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
 * Scans the declaration whose initializer starts at `eq` to the end of its
 * statement. Returns `more: true` if it declares more than one name
 * (`const a = ..., b = ...`); when unsure it reports more than one, so nothing
 * is wrapped. Otherwise `end` is the index just past the statement: after its
 * `;`, or at the newline that ends it.
 */
function scanDeclarators(code, scan, eq) {
  let start = skipSpaceAndComments(code, eq + 1);
  // Skip a generic arrow's type parameters, e.g. the comma in `<T,>(x: T) => x`.
  if (code[start] === "<") {
    start = matchAngleBalance(code, start);
    if (start === -1) return { more: true, end: -1 };
  }

  let depth = 0;
  for (let i = start; i < code.length; i++) {
    const c = scan.masked[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (depth === 0 && c === ";") return { more: false, end: i + 1 };
    else if (depth === 0 && c === ",") return { more: true, end: -1 };
    else if (depth === 0 && c === "\n") {
      const next = skipSpaceAndComments(code, i);
      if (next >= code.length || STATEMENT_START_RE.test(code.slice(next, next + 8))) return { more: false, end: i };
    }
  }
  return { more: false, end: code.length };
}

/**
 * Returns true if the expression starting after the `=` at `eq` is a whole
 * styled component, `styled.tag\`...\`` (with any `.as()` / `.named()` chain),
 * built with one of the local names of dolla's `styled` in `styledNames`.
 */
function isStyledInitializer(code, eq, styledNames) {
  const start = skipSpaceAndComments(code, eq + 1);
  const name = styledNames.find((n) => code.startsWith(n, start) && !/[\w$]/.test(code[start + n.length] ?? ""));
  if (!name) return false;
  const chain = scanStyledChain(code, start + name.length);
  if (!chain) return false;
  const end = skipString(code, chain.backtick);
  return end !== -1 && endsInitializer(code, end);
}

// A call to one of dolla's store functions, but not a method like `obj.getStore`.
const STORE_CALL_RE = /(?<![\w$.])(?:addStore|getStore|hasStore|hasOwnStore)\b/g;

// `function Name` or `const|let Name`, matched at the keyword.
const FUNC_DECL_RE = /(?<![\w$.])(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g;
const LOCAL_DECL_RE = /(?<![\w$.])(?:const|let)\s+([A-Za-z_$][\w$]*)/g;

/**
 * Finds identifiers passed as the store argument (the second) of `addStore`,
 * `getStore`, `hasStore` and `hasOwnStore` calls anywhere in the module.
 * Returns `{ name, start, end }` for each, with the identifier's position.
 */
function findStoreArgs(code, scan) {
  const args = [];
  STORE_CALL_RE.lastIndex = 0;
  let match;
  while ((match = STORE_CALL_RE.exec(scan.masked)) !== null) {
    let i = skipSpaceAndComments(code, match.index + match[0].length);
    if (code[i] === "<") {
      i = matchAngleBalance(code, i);
      if (i === -1) continue;
      i = skipSpaceAndComments(code, i);
    }
    if (code[i] !== "(") continue;

    // Skip the first argument, up to its top-level comma.
    let depth = 0;
    for (i++; i < code.length; i++) {
      const c = scan.masked[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) break;
        depth--;
      } else if (depth === 0 && c === ",") break;
    }
    if (scan.masked[i] !== ",") continue;

    const arg = /^(\s*)([A-Za-z_$][\w$]*)\s*[,)]/.exec(scan.masked.slice(i + 1, i + 257));
    if (!arg) continue;
    const start = i + 1 + arg[1].length;
    args.push({ name: arg[2], start, end: start + arg[2].length });
  }
  return args;
}

// A keyword after one of these characters is part of an expression. (`(` covers `for (let`.)
const EXPRESSION_CONTINUES = new Set("=(,:?[!&|+-*/%<>~^.");
// A keyword after one of these words doesn't start a statement of its own.
const NOT_A_STATEMENT_BEFORE = new Set([
  "export",
  "declare",
  "default",
  "return",
  "typeof",
  "new",
  "await",
  "yield",
  "void",
  "case",
  "else",
  "in",
  "of",
]);

/**
 * Returns true if the keyword at `index` starts a declaration statement:
 * not exported, not `declare`d, and not part of an expression such as
 * `const x = function Foo() {}`.
 */
function isPrivateDeclaration(scan, index) {
  // Comments and strings are masked as whitespace, so this lands on the previous real token.
  let i = index - 1;
  while (i >= 0 && /\s/.test(scan.masked[i])) i--;
  if (i < 0) return true;
  const last = scan.masked[i];
  // An operator or opening bracket means the keyword is inside an expression.
  if (EXPRESSION_CONTINUES.has(last)) return false;
  if (!/[\w$]/.test(last)) return true;
  // A word: the declaration is part of an export, ambient declaration or expression after one of
  // these, and otherwise starts a new statement (code without semicolons, as in `const x = 1\n`).
  let start = i;
  while (start > 0 && /[\w$]/.test(scan.masked[start - 1])) start--;
  return !NOT_A_STATEMENT_BEFORE.has(scan.masked.slice(start, i + 1));
}

// `export { a, b as c }`, matched in masked source. Re-exports (`... from "x"`) are skipped by the caller.
const EXPORT_LIST_RE = /export\s*\{([^}]*)\}/g;
const EXPORT_DEFAULT_RE = /export\s+default\s+/g;
const EXPORT_SPECIFIER_RE = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/;
// `Name = __dolla_export(`, left by an earlier run of this transform.
const WRAPPED_RE = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*=\s*__dolla_export\(/g;

/** Where a wrapper is assigned: at the top of the module, right after its declaration, or at the bottom. */
const HOIST = "hoist";
const BOTTOM = "bottom";

/**
 * Rewrites exported functions so they are bound to a stable HMR wrapper, which
 * keeps their identity across hot reloads (stores rely on this):
 *
 * - `export function Foo` and `export const Foo = <function>` become local
 *   (`function Foo` / `let Foo`) and are exported from the bottom with
 *   `export { Foo };`. Each is assigned `Foo = __dolla_export("<id>:Foo", Foo);`
 *   where code that runs before it can't see the unwrapped function: at the top
 *   of the module for a function declaration (they are initialized before any
 *   statement runs), and right after the declaration for a `const`. So sibling
 *   exports that capture it eagerly (`export const routes = [{ view: Foo }]`)
 *   get the wrapper.
 * - `export default function [Name]`, `export default <arrow or function>` and
 *   `export default Name` (where `Name` is a function declared in the module) are
 *   wrapped with the id `<id>:default`. An anonymous one is named `__dolla_default`.
 * - Functions in `export { Foo, Bar as Baz }` lists are wrapped with the id of
 *   their (first) exported name and moved to the bottom export.
 * - Styled components from dolla's `styled` are wrapped like functions.
 * - Functions declared in the module and passed by name to `addStore`/`getStore`/
 *   `hasStore`/`hasOwnStore` are tagged at each call: `getStore(c, Foo)` becomes
 *   `getStore(c, __dolla_store("<id>:Foo", Foo))`, so every version of `Foo` shares one
 *   store identity, including one used before its module has finished evaluating.
 *
 * Returns the `[exported, local]` pairs of the wrapped exports, the wrapper
 * assignments that go at the top of the module (after the accept call), and
 * whether the output calls `__dolla_export` or `__dolla_store`.
 */
function applyLiveBindings(s, code, id, scan) {
  // Local name -> { id, exported: [names], place: HOIST | BOTTOM | index after the declaration }.
  const wraps = new Map();
  const wrap = (local, exported, place) => {
    let entry = wraps.get(local);
    if (!entry) wraps.set(local, (entry = { id: `${id}:${exported}`, exported: [], place }));
    if (!entry.exported.includes(exported)) entry.exported.push(exported);
  };

  const styledNames = code.includes("styled") ? findDollaStyledImports(code, scan) : [];
  const isWrappable = (eq) => isFunctionInitializer(code, scan, eq) || isStyledInitializer(code, eq, styledNames);

  // Names an earlier run of this transform already wrapped. Their exports are left alone.
  const wrapped = new Set();
  WRAPPED_RE.lastIndex = 0;
  for (let m; (m = WRAPPED_RE.exec(scan.masked)) !== null; ) wrapped.add(m[1]);

  // Module-level declarations that `export default Name` or an export list can wrap.
  const decls = new Map();
  for (const match of topLevelMatches(FUNC_DECL_RE, scan)) {
    if (!decls.has(match[1]) && isPrivateDeclaration(scan, match.index)) decls.set(match[1], { place: HOIST });
  }
  for (const match of topLevelMatches(LOCAL_DECL_RE, scan)) {
    const name = match[1];
    if (decls.has(name) || !isPrivateDeclaration(scan, match.index)) continue;
    const eq = findInitializer(code, scan, match.index + match[0].length);
    if (eq === -1 || !isWrappable(eq)) continue;
    const { more, end } = scanDeclarators(code, scan, eq);
    if (more) continue;
    decls.set(name, { place: end, keyword: match[0].startsWith("const") ? match.index : -1 });
  }
  // Wraps a module-level declaration, turning a `const` into a `let` so the wrapper can be assigned to it.
  const wrapDecl = (local, exported) => {
    const decl = decls.get(local);
    if (decl.keyword >= 0) {
      s.overwrite(decl.keyword, decl.keyword + 5, "let");
      decl.keyword = -1;
    }
    wrap(local, exported, decl.place);
  };
  const canWrap = (local) => !wrapped.has(local) && (wraps.has(local) || decls.has(local));

  for (const match of topLevelMatches(EXPORT_FUNC_RE, scan)) {
    // Remove `export ` (7 chars). The regex guarantees they are there.
    s.remove(match.index, match.index + 7);
    wrap(match[1], match[1], HOIST);
  }

  for (const match of topLevelMatches(EXPORT_CONST_DECL_RE, scan)) {
    const name = match[1];
    const eq = findInitializer(code, scan, match.index + match[0].length);
    if (eq === -1 || !isWrappable(eq)) continue;
    const { more, end } = scanDeclarators(code, scan, eq);
    if (more) continue;

    // `export const Foo` -> `let Foo` so the wrapper can be assigned to it.
    const nameStart = match.index + match[0].length - name.length;
    s.overwrite(match.index, nameStart, "let ");
    wrap(name, name, end);
  }

  let defaultDone = false;
  for (const match of topLevelMatches(EXPORT_DEFAULT_FUNC_RE, scan)) {
    const functionStart = match.index + match[0].search(/(?:async\s+)?function\b/);
    s.remove(match.index, functionStart);

    let name = match[1];
    if (!name) {
      // Name the anonymous function just before its parameter list.
      name = ANONYMOUS_DEFAULT;
      s.appendLeft(match.index + match[0].length - 1, ` ${ANONYMOUS_DEFAULT}`);
    }
    wrap(name, "default", HOIST);
    defaultDone = true;
    break;
  }

  for (const match of defaultDone ? [] : topLevelMatches(EXPORT_DEFAULT_RE, scan)) {
    const after = match.index + match[0].length;
    if (isFunctionInitializer(code, scan, after - 1)) {
      // `export default () => ...` -> `let __dolla_default = () => ...`
      s.overwrite(match.index, after, `let ${ANONYMOUS_DEFAULT} = `);
      wrap(ANONYMOUS_DEFAULT, "default", BOTTOM);
    } else {
      // `export default Name;` where `Name` is a function declared in this module.
      const ident = /^([A-Za-z_$][\w$]*)[ \t]*;?[ \t]*(?=\r?\n|$)/.exec(scan.masked.slice(after));
      if (ident && canWrap(ident[1])) {
        s.remove(match.index, after + ident[0].length);
        if (wraps.has(ident[1])) wrap(ident[1], "default");
        else wrapDecl(ident[1], "default");
      }
    }
    break;
  }

  for (const match of topLevelMatches(EXPORT_LIST_RE, scan)) {
    const close = match.index + match[0].length;
    if (/^\s*from\b/.test(scan.masked.slice(close))) continue;

    const open = match.index + match[0].indexOf("{");
    const kept = [];
    let changed = false;
    // Split the masked list, so commas in string specifiers don't count, and keep the original text.
    let from = open + 1;
    for (const spec of match[1].split(",")) {
      const text = code.slice(from, from + spec.length).trim();
      from += spec.length + 1;
      const m = EXPORT_SPECIFIER_RE.exec(spec.trim());
      if (m && canWrap(m[1])) {
        if (wraps.has(m[1])) wrap(m[1], m[2] ?? m[1]);
        else wrapDecl(m[1], m[2] ?? m[1]);
        changed = true;
      } else if (text) {
        kept.push(text);
      }
    }
    if (!changed) continue;

    if (kept.length) {
      s.overwrite(open + 1, close - 1, ` ${kept.join(", ")} `);
    } else {
      // Remove the whole statement, with its semicolon.
      const semi = /^[ \t]*;/.exec(scan.masked.slice(close));
      s.remove(match.index, close + (semi ? semi[0].length : 0));
    }
  }

  // Tag store arguments that name a function declared in this module with the store identity of
  // its HMR id. In an import cycle a reloaded module's hoisted functions can be used as stores before
  // the module has wrapped them, and without the tag they would get an identity of their own.
  const storeIds = new Map();
  for (const [local, entry] of wraps) storeIds.set(local, entry.id);
  for (const match of topLevelMatches(FUNC_DECL_RE, scan)) {
    if (!storeIds.has(match[1]) && isPrivateDeclaration(scan, match.index)) storeIds.set(match[1], `${id}:${match[1]}`);
  }
  for (const match of topLevelMatches(LOCAL_DECL_RE, scan)) {
    const name = match[1];
    if (storeIds.has(name) || !isPrivateDeclaration(scan, match.index)) continue;
    const eq = findInitializer(code, scan, match.index + match[0].length);
    if (eq !== -1 && isFunctionInitializer(code, scan, eq) && !scanDeclarators(code, scan, eq).more) {
      storeIds.set(name, `${id}:${name}`);
    }
  }
  let tagged = false;
  for (const arg of findStoreArgs(code, scan)) {
    const storeId = storeIds.get(arg.name);
    if (storeId) {
      s.overwrite(arg.start, arg.end, `__dolla_store(${JSON.stringify(storeId)}, ${arg.name})`);
      tagged = true;
    }
  }

  const pairs = [];
  let hoisted = "";
  let bottom = "";
  for (const [local, entry] of wraps) {
    const assign = `${local} = __dolla_export(${JSON.stringify(entry.id)}, ${local});`;
    if (entry.place === HOIST) hoisted += `${assign}\n`;
    else if (entry.place === BOTTOM || entry.place === -1) bottom += `\n${assign}`;
    else s.appendLeft(entry.place, `${code[entry.place - 1] === ";" ? "" : ";"} ${assign}`);
    for (const exported of entry.exported) pairs.push([exported, local]);
  }
  if (pairs.length) {
    const specs = pairs.map(([exported, local]) => (exported === local ? local : `${local} as ${exported}`));
    s.appendRight(code.length, `${bottom}\nexport { ${specs.join(", ")} };\n`);
  }

  return { pairs, hoisted, usesHelpers: tagged || wraps.size > 0 };
}

/*============================*\
||    Import Cycle Warning    ||
\*============================*/

// A call to `createRoot`, but not a method like `obj.createRoot`.
const CREATE_ROOT_RE = /(?<![\w$.])createRoot\s*\(/;

/** The modules `mod` imports statically. Dynamic `import()`s don't re-run when `mod` does. */
function staticImports(mod) {
  // `staticImportedUrls` isn't in Vite's public types, so fall back to every import without it.
  const urls = mod.staticImportedUrls;
  return [...mod.importedModules].filter((dep) => !urls || urls.has(dep.url));
}

/** Breadth-first search from `start` to a module matching `isEnd`. Returns the path, or null. */
function findPath(start, isEnd, next) {
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const mod = queue.shift();
    if (mod !== start && isEnd(mod)) {
      const path = [];
      for (let m = mod; m; m = prev.get(m)) path.unshift(m);
      return path;
    }
    for (const dep of next(mod)) {
      if (!prev.has(dep)) {
        prev.set(dep, mod);
        queue.push(dep);
      }
    }
  }
  return null;
}

/**
 * Returns the import cycle through which a hot update to `changed` re-runs a module that calls
 * `createRoot`, as a list of modules from `changed` back to itself, or null if there is none.
 *
 * On an update Vite gives every module that imports `changed`, directly or not, a new URL. When
 * the browser imports `changed` again, each of its imports with a new URL runs again, and so on
 * down the chain. So a module re-runs if `changed` reaches it by static imports through modules
 * that import `changed`, which only happens when they're in an import cycle with it.
 */
function findRootCycle(changed, rootFiles) {
  const importers = new Set();
  const stack = [changed];
  while (stack.length) {
    for (const importer of stack.pop().importers) {
      if (!importers.has(importer)) {
        importers.add(importer);
        stack.push(importer);
      }
    }
  }

  const toRoot = findPath(
    changed,
    (mod) => rootFiles.has(mod.file),
    (mod) => staticImports(mod).filter((dep) => importers.has(dep)),
  );
  if (!toRoot) return null;
  const back = findPath(toRoot[toRoot.length - 1], (mod) => mod === changed, (mod) => mod.importedModules);
  return back ? [...toRoot, ...back.slice(1)] : null;
}

/*============================*\
||       Linked Installs      ||
\*============================*/

// A linked dolla (`npm link`, `bun link`, a workspace) is not under node_modules as far as
// Vite is concerned: it is served from its real path, as source, like the app's own files.

/** Whether each directory seen so far belongs to a copy of dolla. */
const dollaDirs = new Map();

function isInDolla(dir) {
  let known = dollaDirs.get(dir);
  if (known === undefined) {
    const manifest = path.join(dir, "package.json");
    const parent = path.dirname(dir);
    // The nearest package.json decides, so an app inside a dolla checkout is still an app.
    if (existsSync(manifest)) known = readPackageName(manifest) === PACKAGE_NAME;
    else known = parent !== dir && isInDolla(parent);
    dollaDirs.set(dir, known);
  }
  return known;
}

function readPackageName(manifest) {
  try {
    return JSON.parse(readFileSync(manifest, "utf8")).name;
  } catch {
    return undefined;
  }
}

/** Whether the app at `root` gets dolla through a link to a folder outside node_modules. */
function isDollaLinked(root) {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const installed = path.join(dir, "node_modules", PACKAGE_NAME);
    if (existsSync(installed)) return !realpathSync(installed).split(path.sep).includes("node_modules");
    if (path.dirname(dir) === dir) return false;
  }
}

/*============================*\
||         Plugin Default     ||
\*============================*/

export default function dollaPlugin() {
  let projectRoot = process.cwd();
  // Files that call `createRoot`, as seen by `transform`.
  const rootFiles = new Set();
  // Import edges into a root module that were already warned about, e.g. "/src/rpc.ts -> /src/app.tsx".
  const warnedEdges = new Set();

  return {
    name: "dolla",
    enforce: "pre",
    // Everything the plugin adds is for HMR, which a production build doesn't have. Vitest also
    // runs a dev server, in `test` mode, where wrapping every exported function only gets in the way.
    apply: (_config, env) => env.command === "serve" && env.mode !== "test",
    config(config) {
      // An app that excludes dolla from pre-bundling (`@manyducks.co/dolla` also excludes its
      // subpaths) loads it as is. Pre-bundling the HMR runtime there would give it a copy of
      // dolla of its own, which never sees the app's views.
      const excluded = config.optimizeDeps?.exclude ?? [];
      if (excluded.some((name) => HMR_MODULE === name || HMR_MODULE.startsWith(`${name}/`))) return;
      // Vite doesn't pre-bundle a linked dolla either, so the same goes for it.
      if (isDollaLinked(config.root ?? process.cwd())) return;
      // The import of the HMR runtime is added by `transform`, which Vite's dependency scanner
      // doesn't run. Without this the first dev start finds it late and reloads the page.
      return { optimizeDeps: { include: [HMR_MODULE] } };
    },
    configResolved(config) {
      projectRoot = config.root;
    },
    hotUpdate({ modules }) {
      if (this.environment.name !== "client" || rootFiles.size === 0) return;
      const rel = (mod) => path.relative(projectRoot, mod.file);

      for (const changed of modules) {
        const cycle = findRootCycle(changed, rootFiles);
        if (!cycle) continue;

        // The cycle closes where something imports the root module; report each such import once.
        const rootIndex = cycle.findIndex((mod) => rootFiles.has(mod.file));
        const root = cycle[rootIndex];
        const into = cycle[rootIndex - 1];
        const edge = `${into.file} -> ${root.file}`;
        if (warnedEdges.has(edge)) continue;
        warnedEdges.add(edge);

        this.environment.logger.warn(
          `[dolla:hmr] Editing ${rel(changed)} re-runs ${rel(root)}, which creates the app root, because they import each other:\n` +
            cycle.map((mod, i) => `  ${i ? "-> " : ""}${rel(mod)}`).join("\n") +
            `\n${rel(into)} imports ${rel(root)}, so a hot update to any module in this cycle runs ${rel(root)} again` +
            ` and mounts the app a second time. Remove that import to break the cycle.`,
        );
      }
    },
    transform(code, id) {
      if (!/\.[jt]sx?$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      // Dolla's own modules, reached through a link. Wrapping their exports would make them
      // import the HMR runtime, which imports them, and the app would fail to start.
      if (isInDolla(path.dirname(id))) return null;

      const s = new MagicString(code);

      // Every file is processed, so even the entry module (which may have no
      // matching exports) gets an `import.meta.hot.accept` self-accept
      // boundary. That contains HMR cascades and prevents a full-reload
      // re-mount of the whole app.
      const scan = maskNonCode(code);

      if (CREATE_ROOT_RE.test(scan.masked)) rootFiles.add(id);
      else rootFiles.delete(id);

      // Inject `import.meta.hot.accept` into EVERY module — including the
      // entry module, which may have no matching exports. Without a
      // self-accept handler on the entry, an update to a deeply-nested
      // dependency bubbles all the way up and Vite falls through to a full
      // reload of the entry. Re-mounting the whole app on every nested edit
      // re-mounts the current route and duplicates its DOM in #app. Making each
      // module a boundary contains the update so it resolves via the in-place
      // `replaceView` path instead.

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
      // Live-binding: wrap named function exports and private stores in a stable proxy for HMR.
      const live = applyLiveBindings(s, code, id, scan);
      let usesHelpers = live.usesHelpers;

      // A module that accepts its own updates is left to handle them.
      if (!HMR_ACCEPT_RE.test(scan.masked)) {
        const entries = findExportEntries(code, scan, live.pairs).map(([exported, local]) =>
          exported === local ? local : `${exported}: ${local}`,
        );
        s.appendLeft(
          0,
          `if (import.meta.hot) { import.meta.hot.accept((newModule) => { __dolla_apply(newModule, { ${entries.join(", ")} }, import.meta.hot); }); }\n`,
        );
        usesHelpers = true;
      }
      // Wrapper assignments for function declarations go right after the accept call, before any
      // module code runs, so everything in the module that captures the function gets the wrapper.
      s.appendLeft(0, live.hoisted);

      // Import the helpers the module doesn't already import itself.
      if (usesHelpers) {
        const missing = HMR_HELPERS.filter((name) => !findNamedImports(code, scan, HMR_MODULE, name).includes(name));
        if (missing.length) s.prepend(`import { ${missing.join(", ")} } from "${HMR_MODULE}";\n`);
      }

      if (
        code.includes("css") &&
        applyHotCss(s, code, id, scan) &&
        !findNamedImports(code, scan, HMR_MODULE, "__dolla_css").includes("__dolla_css")
      ) {
        s.appendLeft(0, HOT_CSS_IMPORT);
      }

      if (code.includes("styled")) applyStyledNamer(s, code, scan);

      // Always return the code, even if unchanged, since every module is an HMR boundary.
      return { code: s.toString(), map: s.generateMap({ source: id, includeContent: true, hires: true }) };
    },
  };
}
