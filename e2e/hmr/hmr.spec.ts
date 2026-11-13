import type { Page } from "@playwright/test";
import { expect, test, type App } from "./fixtures.js";

/**
 * HMR in a real browser on a real Vite dev server. Each test writes a small app, edits
 * it and checks that the update happens in place: the page doesn't reload, and the
 * state that should survive does.
 */

const MAIN = (view: string, from: string) =>
  [
    `import { createRoot } from "@manyducks.co/dolla";`,
    `import { ${view} } from "${from}";`,
    ``,
    `createRoot("#app").mount(${view});`,
    ``,
  ].join("\n");

/** Marks the page, so `expectNoReload` can tell a hot update from a full reload. */
async function markPage(page: Page) {
  await page.evaluate(() => ((window as any).__dollaE2E = true));
}

async function expectNoReload(page: Page, app: App) {
  expect(await page.evaluate(() => (window as any).__dollaE2E)).toBe(true);
  expect(app.loads()).toBe(1);
}

test("a view updates in place", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/App.tsx", `export function App() {\n  return <p id="text">one</p>;\n}\n`);
  await app.start();
  await markPage(page);

  app.edit("src/App.tsx", (code) => code.replace("one", "two"));
  await expect(page.locator("#text")).toHaveText("two");
  await expectNoReload(page, app);
  expect(app.consoleLogs).toContainEqual(expect.stringMatching(/\[dolla:hmr\] hot reload: 1 view instance/));
});

test("a store keeps its state and effects when the view that provides it reloads", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write(
    "src/store.ts",
    [
      `import { createAtom, onEffect } from "@manyducks.co/dolla";`,
      ``,
      `export function CounterStore(_props, c) {`,
      `  const [count, setCount] = createAtom(0);`,
      `  onEffect(c, () => {`,
      `    (window as any).__effectRuns = ((window as any).__effectRuns ?? 0) + 1;`,
      `    (window as any).__effectSaw = count();`,
      `  });`,
      `  return { count, increment: () => setCount(count() + 1) };`,
      `}`,
      ``,
    ].join("\n"),
  );
  app.write(
    "src/App.tsx",
    [
      `import { addStore } from "@manyducks.co/dolla";`,
      `import { CounterStore } from "./store";`,
      ``,
      `export function App(_props, c) {`,
      `  const store = addStore(c, CounterStore);`,
      `  return (`,
      `    <div>`,
      `      <p id="label">version one</p>`,
      `      <button id="inc" onClick={store.increment}>{store.count}</button>`,
      `    </div>`,
      `  );`,
      `}`,
      ``,
    ].join("\n"),
  );
  await app.start();
  await markPage(page);

  await page.click("#inc");
  await expect(page.locator("#inc")).toHaveText("1");

  app.edit("src/App.tsx", (code) => code.replace("version one", "version two"));
  await expect(page.locator("#label")).toHaveText("version two");
  // The store instance survived the reload with its state...
  await expect(page.locator("#inc")).toHaveText("1");

  // ...and its effect still runs.
  await page.click("#inc");
  await expect(page.locator("#inc")).toHaveText("2");
  await expect.poll(() => page.evaluate(() => (window as any).__effectSaw)).toBe(2);
  await expectNoReload(page, app);
});

test("a view referenced from a sibling export updates", async ({ page, app }) => {
  app.write(
    "src/main.tsx",
    [
      `import { createRoot } from "@manyducks.co/dolla";`,
      `import { routes } from "./routes";`,
      ``,
      `createRoot("#app").mount(routes[0].view);`,
      ``,
    ].join("\n"),
  );
  app.write(
    "src/routes.tsx",
    [
      `export function Home() {`,
      `  return <p id="home">home one</p>;`,
      `}`,
      ``,
      `export const routes = [{ path: "/", view: Home }];`,
      ``,
    ].join("\n"),
  );
  await app.start();
  await markPage(page);

  app.edit("src/routes.tsx", (code) => code.replace("home one", "home two"));
  await expect(page.locator("#home")).toHaveText("home two");
  await expectNoReload(page, app);
});

test("a styled component restyles mounted and newly mounted elements", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write(
    "src/Button.tsx",
    [
      `import { styled } from "@manyducks.co/dolla/styled";`,
      ``,
      `export const Button = styled.button\``,
      `  color: rgb(255, 0, 0);`,
      `\`;`,
      ``,
    ].join("\n"),
  );
  app.write(
    "src/App.tsx",
    [
      `import { createAtom, showIf } from "@manyducks.co/dolla";`,
      `import { Button } from "./Button";`,
      ``,
      `export function App() {`,
      `  const [more, setMore] = createAtom(false);`,
      `  return (`,
      `    <div>`,
      `      <Button id="first" onClick={() => setMore(true)}>first</Button>`,
      `      {showIf(more, <Button id="second">second</Button>)}`,
      `    </div>`,
      `  );`,
      `}`,
      ``,
    ].join("\n"),
  );
  await app.start();
  await markPage(page);
  await expect(page.locator("#first")).toHaveCSS("color", "rgb(255, 0, 0)");

  app.edit("src/Button.tsx", (code) => code.replace("rgb(255, 0, 0)", "rgb(0, 0, 255)"));
  await expect(page.locator("#first")).toHaveCSS("color", "rgb(0, 0, 255)");

  // App.tsx didn't reload, so it renders the Button it imported before the edit.
  await page.click("#first");
  await expect(page.locator("#second")).toHaveCSS("color", "rgb(0, 0, 255)");
  await expectNoReload(page, app);
});

test("a changed constant reaches the modules that import it", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/config.ts", `export const GREETING = "hello";\n`);
  app.write(
    "src/App.tsx",
    [
      `import { GREETING } from "./config";`,
      ``,
      `export function App() {`,
      `  return <p id="greeting">{GREETING}</p>;`,
      `}`,
      ``,
    ].join("\n"),
  );
  await app.start();
  await markPage(page);

  app.edit("src/config.ts", (code) => code.replace("hello", "goodbye"));
  await expect(page.locator("#greeting")).toHaveText("goodbye");
  expect(app.serverLogs).toContainEqual(expect.stringMatching(/hmr invalidate .*config\.ts export GREETING changed/));
  await expectNoReload(page, app);
});

test("a store in a module without semicolons is found after its module reloads", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write(
    "src/auth.ts",
    [
      `import { addStore, createAtom, getStore } from "@manyducks.co/dolla"`,
      ``,
      `// version one`,
      `function AuthStore() {`,
      `  const [count, setCount] = createAtom(0)`,
      `  return { count, increment: () => setCount(count() + 1) }`,
      `}`,
      ``,
      `export const addAuth = (c) => addStore(c, AuthStore)`,
      `export const getAuth = (c) => getStore(c, AuthStore)`,
      ``,
    ].join("\n"),
  );
  app.write(
    "src/Counter.tsx",
    [
      `import { getAuth } from "./auth"`,
      ``,
      `export function Counter(_props, c) {`,
      `  const auth = getAuth(c)`,
      `  return <button id="inc" data-version="one" onClick={auth.increment}>{auth.count}</button>`,
      `}`,
      ``,
    ].join("\n"),
  );
  app.write(
    "src/App.tsx",
    [
      `import { addAuth } from "./auth"`,
      `import { Counter } from "./Counter"`,
      ``,
      `export function App(_props, c) {`,
      `  addAuth(c)`,
      `  return <Counter />`,
      `}`,
      ``,
    ].join("\n"),
  );
  await app.start();
  await markPage(page);
  await page.click("#inc");
  await expect(page.locator("#inc")).toHaveText("1");

  app.edit("src/auth.ts", (code) => code.replace("version one", "version two"));
  await expect.poll(() => app.consoleLogs.some((log) => log.includes("auth.ts"))).toBe(true);

  // Re-rendering Counter looks the store up with the reloaded module's getAuth.
  app.edit("src/Counter.tsx", (code) => code.replace(`data-version="one"`, `data-version="two"`));
  await expect(page.locator("#inc")).toHaveAttribute("data-version", "two");
  await expect(page.locator("#inc")).toHaveText("1");
  expect(app.pageErrors).toEqual([]);
  await expectNoReload(page, app);
});

test("a module that throws at the top level reports only its own error", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/App.tsx", `export function App() {\n  return <p id="text">one</p>;\n}\n`);
  await app.start();
  await markPage(page);

  app.edit("src/App.tsx", (code) => `throw new Error("boom");\n${code}`);
  await expect.poll(() => [...app.consoleLogs, ...app.pageErrors].some((log) => log.includes("boom"))).toBe(true);
  // Give a TypeError from __dolla_apply time to show up.
  await page.waitForTimeout(500);
  const errors = [...app.consoleLogs.filter((log) => log.startsWith("error")), ...app.pageErrors];
  expect(errors.filter((log) => /TypeError|__dolla_apply/.test(log))).toEqual([]);

  // Fixing the module recovers without a reload.
  app.edit("src/App.tsx", (code) => code.replace(`throw new Error("boom");\n`, "").replace("one", "two"));
  await expect(page.locator("#text")).toHaveText("two");
  await expectNoReload(page, app);
});

test("the first dev start doesn't reload the page to optimize dependencies", async ({ page, app }) => {
  // Every test starts with an empty node_modules/.vite, like a fresh checkout. By default Vite
  // waits for the first page's imports before it pre-bundles, which hides a dependency only the
  // plugin's transform adds. Without the wait, such a dependency is found late and Vite reloads.
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/App.tsx", `export function App() {\n  return <p id="text">one</p>;\n}\n`);
  await app.start({ viteConfig: { optimizeDeps: { holdUntilCrawlEnd: false } } });
  await markPage(page);

  await page.waitForTimeout(1_000);
  expect(app.serverLogs.filter((log) => /optimized dependencies changed|reloading/.test(log))).toEqual([]);
  await expectNoReload(page, app);
});

test("HMR works when the app excludes dolla from dependency optimization", async ({ page, app }) => {
  // Quack's config: dolla is served as is instead of pre-bundled.
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/App.tsx", `export function App() {\n  return <p id="text">one</p>;\n}\n`);
  await app.start({
    viteConfig: { optimizeDeps: { exclude: ["@manyducks.co/dolla", "@manyducks.co/dolla/jsx-dev-runtime"] } },
  });
  await markPage(page);

  app.edit("src/App.tsx", (code) => code.replace("one", "two"));
  await expect(page.locator("#text")).toHaveText("two");
  await expectNoReload(page, app);
});

test("an app that links dolla from outside node_modules starts and updates in place", async ({ page, app }) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/App.tsx", `export function App() {\n  return <p id="text">one</p>;\n}\n`);
  // Quack's config, which serves dolla as is.
  await app.start({
    linked: true,
    viteConfig: { optimizeDeps: { exclude: ["@manyducks.co/dolla", "@manyducks.co/dolla/jsx-dev-runtime"] } },
  });
  await markPage(page);
  expect(app.pageErrors).toEqual([]);

  app.edit("src/App.tsx", (code) => code.replace("one", "two"));
  await expect(page.locator("#text")).toHaveText("two");
  await expectNoReload(page, app);
  expect(app.pageErrors).toEqual([]);
});

test("an app that links dolla and lets Vite pre-bundle its dependencies starts and updates in place", async ({
  page,
  app,
}) => {
  app.write("src/main.tsx", MAIN("App", "./App"));
  app.write("src/App.tsx", `export function App() {\n  return <p id="text">one</p>;\n}\n`);
  await app.start({ linked: true });
  await markPage(page);
  expect(app.pageErrors).toEqual([]);

  app.edit("src/App.tsx", (code) => code.replace("one", "two"));
  await expect(page.locator("#text")).toHaveText("two");
  await expectNoReload(page, app);
  expect(app.pageErrors).toEqual([]);
});
