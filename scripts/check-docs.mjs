import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = [
  "README.md",
  ...fs
    .readdirSync(path.join(root, "docs"))
    .filter((file) => file.endsWith(".md"))
    .map((file) => `docs/${file}`),
  ...["router", "translate", "http", "virtual"].map((name) => `src/${name}/README.md`),
];

const HTML_PAGE = "docs/html.md";
const HTML_FENCE_ALLOWLIST = new Set([HTML_PAGE, "docs/templates.md", "docs/getting-started.md"]);
const HTML_HELPER_ALLOWLIST = new Set([HTML_PAGE, "docs/templates.md", "docs/contributing.md"]);
const THIS_HOOK_PATTERN = /\b(?:onMount|onCleanup|onEffect|addStore|getStore|getDebug)\(this\b/;

function githubSlug(heading) {
  return heading
    .toLowerCase()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\w\- ]/g, "")
    .replace(/ /g, "-");
}

const headings = new Map();

for (const file of files) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  const anchors = new Set();
  const lines = text.split("\n");

  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.*)$/);
    if (!match) continue;
    const slug = githubSlug(match[1]);
    anchors.add(slug);
    // Tolerate sluggers that collapse repeated spaces.
    anchors.add(slug.replace(/-+/g, "-"));
  }

  headings.set(path.resolve(full), anchors);
}

const linkPattern = /\]\(([^)\s]+)\)/g;
const forbiddenTerms = [
  [/\bpark(?:ed|ing)?\b/i, "use hide/show terminology, not park"],
  [/\bonSuspend\b|\bonResume\b|\bisSuspended\b/, "use mount/cleanup terminology"],
  [/Suspension Hooks/, "use 'lifecycle hooks'"],
  [/\bsuspend(?:ed|s|ing|sion)?\b/, "use hide/show terminology, not suspend"],
];
let problems = 0;

function report(file, line, message) {
  console.error(`[docs] ${file}${line ? `:${line}` : ""}: ${message}`);
  problems++;
}

/**
 * Walks the fences in one file, checking both fence balance and the docs
 * conventions. Supports fences of three or more backticks so nested examples
 * (like the ones in contributing.md) are handled correctly.
 */
function checkFences(file, lines) {
  let fence = null;
  let block = [];
  let allowThis = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(`{3,})(.*)$/);

    if (fence === null) {
      if (!match) continue;

      fence = { length: match[1].length, lang: match[2].trim(), line: i + 1 };
      block = [];
      allowThis = lines
        .slice(Math.max(0, i - 2), i)
        .some((previous) => previous.includes("legacy-this"));

      if (!fence.lang) {
        report(file, fence.line, "unlabeled code fence");
      }
      continue;
    }

    const isClosing =
      match !== null && match[1].length >= fence.length && match[2].trim() === "";

    if (!isClosing) {
      block.push(line);
      continue;
    }

    const content = block.join("\n");

    if (file !== HTML_PAGE && content.includes("<//>")) {
      report(file, fence.line, "use </> instead of <//> (only docs/html.md may show <//>)");
    }

    if (!allowThis && THIS_HOOK_PATTERN.test(content)) {
      report(
        file,
        fence.line,
        "use the context argument instead of this, or mark the block with <!-- legacy-this -->",
      );
    }

    if (fence.lang === "html" && !HTML_FENCE_ALLOWLIST.has(file)) {
      report(file, fence.line, "html code blocks belong in docs/html.md or docs/templates.md");
    }

    if (!HTML_HELPER_ALLOWLIST.has(file) && content.includes("html`")) {
      report(file, fence.line, "use JSX in code blocks; the html helper belongs in docs/html.md");
    }

    fence = null;
    block = [];
    allowThis = false;
  }

  if (fence !== null) {
    report(file, fence.line, "unclosed code fence");
  }
}

for (const file of files) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  const lines = text.split("\n");

  checkFences(file, lines);

  // The contributing guide names the forbidden terms on purpose.
  if (file !== "docs/contributing.md") {
    for (const [pattern, message] of forbiddenTerms) {
      if (pattern.test(text)) {
        report(file, 0, `forbidden terminology: ${message}`);
      }
    }
  }

  let match;
  while ((match = linkPattern.exec(text))) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;

    const [name, anchor] = target.split("#");
    const resolved = name ? path.resolve(path.dirname(full), name) : full;

    if (!fs.existsSync(resolved)) {
      report(file, 0, `broken link: ${target}`);
      continue;
    }

    if (!anchor) continue;

    const anchors = headings.get(resolved);
    if (anchors && !anchors.has(anchor) && !anchors.has(anchor.replace(/-+/g, "-"))) {
      report(file, 0, `broken anchor: ${target}`);
    }
  }
}

if (problems > 0) {
  process.exitCode = 1;
} else {
  console.log("[docs] links, anchors, fences, and conventions look good");
}
