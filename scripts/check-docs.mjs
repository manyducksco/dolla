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

  const fences = lines.filter((line) => line.startsWith("```")).length;
  if (fences % 2 !== 0) {
    console.error(`[docs] unbalanced code fences: ${file}`);
    process.exitCode = 1;
  }

  headings.set(path.resolve(full), anchors);
}

const linkPattern = /\]\(([^)\s]+)\)/g;
let problems = 0;

for (const file of files) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  let match;

  while ((match = linkPattern.exec(text))) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;

    const [name, anchor] = target.split("#");
    const resolved = name ? path.resolve(path.dirname(full), name) : full;

    if (!fs.existsSync(resolved)) {
      console.error(`[docs] broken link: ${file} -> ${target}`);
      problems++;
      continue;
    }

    if (!anchor) continue;

    const anchors = headings.get(resolved);
    if (anchors && !anchors.has(anchor) && !anchors.has(anchor.replace(/-+/g, "-"))) {
      console.error(`[docs] broken anchor: ${file} -> ${target}`);
      problems++;
    }
  }
}

if (problems > 0) {
  process.exitCode = 1;
} else {
  console.log("[docs] links, anchors, and code fences look good");
}
