import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

export const REPO = path.resolve(import.meta.dirname, "..");
export const WORK = path.join(REPO, "e2e", ".work");
/** The packed package, as `npm install` would put it in an app's node_modules. */
export const PACKAGE = path.join(WORK, "package");

/**
 * Builds dolla and packs it, so tests run against what would be published. The
 * apps live inside the repo, so the packed package resolves Vite and its own
 * dependencies (magic-string) from the repo's node_modules.
 *
 * - `DOLLA_E2E_SOURCE=<path>` tests another checkout instead, e.g. a worktree of
 *   `main`, to compare a change against it. It needs its own `node_modules` to build.
 * - `DOLLA_E2E_SKIP_BUILD=1` packs the existing `dist` without building it first.
 */
export default function globalSetup() {
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });

  const source = path.resolve(process.env.DOLLA_E2E_SOURCE ?? REPO);
  if (!process.env.DOLLA_E2E_SKIP_BUILD) {
    execFileSync("npm", ["run", "build"], { cwd: source, stdio: "ignore" });
  }
  execFileSync("npm", ["pack", "--pack-destination", WORK], { cwd: source, stdio: "ignore" });
  const tarball = readdirSync(WORK).find((name) => name.endsWith(".tgz"))!;
  // The tarball's contents are in a `package` folder.
  execFileSync("tar", ["-xzf", tarball], { cwd: WORK });
}
