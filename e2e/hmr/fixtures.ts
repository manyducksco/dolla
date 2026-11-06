import { test as base, expect, type Page } from "@playwright/test";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createLogger, createServer, type ViteDevServer } from "vite";
import { PACKAGE, WORK } from "../global-setup.js";

const TEMPLATE = path.join(import.meta.dirname, "template");

type StartOptions = {
  /** Extra Vite config for the app, merged into its `vite.config.js`. */
  viteConfig?: Record<string, unknown>;
};

export type App = {
  dir: string;
  /** Writes a file of the app, relative to its root. Writing after `start` triggers a hot update. */
  write(file: string, content: string): void;
  /** Rewrites a file of the app with `fn`. */
  edit(file: string, fn: (content: string) => string): void;
  /** Starts the dev server and opens the app in `page`. */
  start(options?: StartOptions): Promise<void>;
  /** What the dev server has logged, without colors. */
  serverLogs: string[];
  /** What the page has logged to the console, as `type: text`. */
  consoleLogs: string[];
  /** Page errors, including uncaught exceptions. */
  pageErrors: string[];
  /** How many times the page has loaded. More than one means a full reload happened. */
  loads(): number;
};

const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, "");

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use, testInfo) => {
    const dir = path.join(WORK, "apps", testInfo.testId);
    cpSync(TEMPLATE, dir, { recursive: true });
    // A real copy, not a link: Vite and the plugin treat files under node_modules as dependencies.
    cpSync(PACKAGE, path.join(dir, "node_modules", "@manyducks.co", "dolla"), { recursive: true });

    const serverLogs: string[] = [];
    const consoleLogs: string[] = [];
    const pageErrors: string[] = [];
    let loads = 0;
    let server: ViteDevServer | undefined;

    page.on("console", (msg) => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("load", () => loads++);

    const write = (file: string, content: string) => {
      const full = path.join(dir, file);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content);
    };

    const app: App = {
      dir,
      write,
      edit: (file, fn) => write(file, fn(readFileSync(path.join(dir, file), "utf8"))),
      serverLogs,
      consoleLogs,
      pageErrors,
      loads: () => loads,
      async start(options = {}) {
        write(
          "vite.config.js",
          [
            `import { defineConfig } from "vite";`,
            `import dolla from "@manyducks.co/dolla/vite-plugin";`,
            `export default defineConfig({ plugins: [dolla()], ...${JSON.stringify(options.viteConfig ?? {})} });`,
            ``,
          ].join("\n"),
        );

        const logger = createLogger("info", { allowClearScreen: false });
        for (const level of ["info", "warn", "error"] as const) {
          logger[level] = (msg) => void serverLogs.push(stripAnsi(msg));
        }

        server = await createServer({
          root: dir,
          configFile: path.join(dir, "vite.config.js"),
          customLogger: logger,
          server: { port: 0, strictPort: false },
        });
        await server.listen();
        await page.goto(server.resolvedUrls!.local[0]);
        await expect(page.locator("#app")).not.toBeEmpty();
      },
    };

    await use(app);

    await server?.close();
  },
});

export { expect };
