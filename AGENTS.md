# Agent Instructions

## Test-driven development

Use test-driven development for every bug fix and behavior change.

1. **Write the test first.** Before touching source code, write a test that captures the expected behavior. For a bug, reproduce it with the smallest input that shows the wrong result.
2. **Watch it fail.** Run the test and confirm it fails *for the reason you expect*. Check the actual vs. expected output, not just that it failed. A test that passes before the fix doesn't reproduce the bug: tighten it until it fails, or reconsider whether the bug exists.
3. **Fix the code.** Make the smallest change that makes the test pass.
4. **Run the full suite.** Run the unit tests and the browser tests (`npm run test:e2e`) to confirm nothing else broke, then typecheck.

Use tests to check your assumptions about how the code works, too. If you're unsure what a function does with some input, write a quick test and run it instead of guessing from the source.

### Writing tests

- Tests live next to the code they cover as `*.test.ts` (e.g. `src/core/signals.ts` → `src/core/signals.test.ts`). Add to the existing file and `describe` block where one fits. Use a new file only for behavior that spans several modules (e.g. `src/core/markup/nodes/ordering.test.ts`).
- Tests run in vitest with happy-dom. happy-dom has no layout and doesn't implement some newer DOM APIs (e.g. `Element.moveBefore`). Polyfill them in the test when the code path depends on them, and restore the original afterwards.
- Assert on observable results such as DOM output (`textContent`, `innerHTML`), signal values and call counts, not on private internals.
- Keep regression tests after the fix. They are the record that the bug stays fixed.
- Prefer unit tests. Write a browser test (`e2e/`) only for behavior a unit test can't show, such as what happens in a real browser or on a real Vite dev server. Each one starts a dev server and a browser, so they are much slower to run.

### Commands

```sh
npx vitest run path/to/file.test.ts           # run one file
npx vitest run path/to/file.test.ts -t "name" # run matching tests
npx vitest run                                # full suite
npx tsc --noEmit -p .                         # typecheck
npm run build && npm run bundle:check         # bundle size and tree-shaking budgets
npm run test:e2e                              # browser tests (builds and packs dolla first)
```

Each browser test writes a small app under `e2e/.work/`, installs the packed package into it, runs it on a Vite dev server in headless Chromium, edits its files and checks the page. Add a test to `e2e/hmr/hmr.spec.ts` for HMR behavior that unit tests can't show, such as what Vite does with the plugin's output. To see how another version behaves, point the tests at its checkout with `DOLLA_E2E_SOURCE=<path> npm run test:e2e`. The first run on a machine may need `npx playwright install chromium`.

Run `bundle:check` after changes to `src/core`. It enforces gzip size budgets and runs before publishing. If a change goes over budget, report it rather than raising the budget yourself.

## Releases

Every release gets a changelog file at `docs/changelogs/<version>.md` (e.g. `docs/changelogs/5.0.3.md`). Generate it from the commits since the previous release tag (`git log v<previous>..HEAD`) and commit it with the version bump in the "Prepare the <version> release" commit.

Write it for people upgrading, not for contributors: describe what changed for users and why it matters, grouped under headings such as Breaking changes, Features and Fixes (leave out empty groups). Skip changes with no effect on users, such as tests and internal refactors, and link to the relevant page in `docs/` where one exists.
