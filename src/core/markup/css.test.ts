import { describe, expect, test } from "vitest";
import { cleanupContext, createContext, mountContext } from "../context.js";
import { css, isConditionalTemplate, isCSSTemplate } from "./css.js";

describe("css tagged template", () => {
  test("returns a CSSTemplate", () => {
    const tpl = css`
      color: red;
    `;
    expect(isCSSTemplate(tpl)).toBe(true);
  });

  test("has a className property", () => {
    const tpl = css`
      color: red;
    `;
    expect(tpl.className).toBeTruthy();
    expect(tpl.className).toMatch(/^css-/);
  });

  test("same input produces same className", () => {
    const tpl1 = css`
      color: red;
    `;
    const tpl2 = css`
      color: red;
    `;
    expect(tpl1.className).toBe(tpl2.className);
  });

  test("different input produces different className", () => {
    const tpl1 = css`
      color: red;
    `;
    const tpl2 = css`
      color: blue;
    `;
    expect(tpl1.className).not.toBe(tpl2.className);
  });

  test("toString returns className", () => {
    const tpl = css`
      font-size: 14px;
    `;
    expect(String(tpl)).toBe(tpl.className);
    expect(`${tpl}`).toBe(tpl.className);
  });

  test("attach adds className to element", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: red;
    `;
    tpl.attach(ctx, el);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });

  test("attach with false condition does not add class", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: red;
    `;
    tpl.attach(ctx, el, false);
    expect(el.classList.contains(tpl.className)).toBe(false);
  });

  test("attach with truthy condition adds class", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: red;
    `;
    tpl.attach(ctx, el, true);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });

  test("static interpolation is included", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const size = "20px";
    const tpl = css`
      font-size: ${size};
    `;
    tpl.attach(ctx, el);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });

  test("template with multiple values", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const color = "blue";
    const padding = "10px";
    const tpl = css`
      color: ${color};
      padding: ${padding};
    `;
    tpl.attach(ctx, el);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });

  test("nested template interpolation", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const base = css`
      color: red;
    `;
    const tpl = css`
      ${base} {
        font-weight: bold;
      }
    `;
    tpl.attach(ctx, el);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });
});

describe("css.named()", () => {
  test("css.named('name') produces className matching the given prefix", () => {
    const tpl = css.named("sidebar")`
      color: red;
    `;
    expect(tpl.className).toMatch(/^sidebar-/);
  });

  test("css.named('name') preserves the same hash as css for identical content", () => {
    const plain = css`
      color: red;
    `;
    const named = css.named("sidebar")`
      color: red;
    `;
    const hash = plain.className.replace(/^css-/, "");
    expect(named.className).toBe(`sidebar-${hash}`);
  });

  test("different prefixes produce classNames that differ only by prefix", () => {
    const tpl1 = css.named("foo")`
      color: red;
    `;
    const tpl2 = css.named("bar")`
      color: red;
    `;
    const hash = tpl1.className.replace(/^foo-/, "");
    expect(tpl2.className).toBe(`bar-${hash}`);
  });

  test("instance .named('name') changes the prefix", () => {
    const tpl = css`
      color: red;
    `.named("header");
    expect(tpl.className).toMatch(/^header-/);
  });

  test("instance .named() does not mutate the original template", () => {
    const original = css`
      color: red;
    `;
    const renamed = original.named("header");
    expect(original.className).toMatch(/^css-/);
    expect(renamed.className).toMatch(/^header-/);
    expect(renamed).not.toBe(original);
  });

  test("instance .named() preserves the hash", () => {
    const tpl = css`
      color: red;
    `;
    const hash = tpl.className.replace(/^css-/, "");
    expect(tpl.named("nav").className).toBe(`nav-${hash}`);
  });

  test("toString returns the renamed className", () => {
    const tpl = css`
      color: red;
    `.named("widget");
    expect(String(tpl)).toBe(tpl.className);
    expect(`${tpl}`).toBe(tpl.className);
  });

  test("css.named() sanitizes spaces in the name", () => {
    const tpl = css.named("some name")`
      color: red;
    `;
    expect(tpl.className).toMatch(/^some-name-/);
  });

  test("css.named() sanitizes special characters in the name", () => {
    const tpl = css.named("my@#$class")`
      color: red;
    `;
    expect(tpl.className).toMatch(/^my-class-/);
  });

  test("css.named() falls back to css- when the sanitized name is empty", () => {
    const tpl = css.named("@#$")`
      color: red;
    `;
    expect(tpl.className).toMatch(/^css-/);
  });
});

describe("instance rule cleanup", () => {
  test("removes instance rule from stylesheet after context cleanup", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const color = () => "red";
    const tpl = css`
      color: ${color};
    `;

    const sheets = document.adoptedStyleSheets;
    const sheet = sheets[sheets.length - 1];
    const beforeLength = sheet.cssRules.length;

    tpl.attach(ctx, el);

    expect(sheet.cssRules.length).toBe(beforeLength + 2);

    const instanceRules = Array.from(sheet.cssRules).filter((r) =>
      (r as CSSStyleRule).selectorText?.startsWith(".css-instance-"),
    );
    expect(instanceRules.length).toBe(1);

    mountContext(ctx);
    cleanupContext(ctx);

    expect(sheet.cssRules.length).toBe(beforeLength + 1);

    const remaining = Array.from(sheet.cssRules).filter((r) =>
      (r as CSSStyleRule).selectorText?.startsWith(".css-instance-"),
    );
    expect(remaining.length).toBe(0);
  });

  test("static class rule remains after cleanup of dynamic template", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const size = () => "20px";
    const tpl = css`
      font-size: ${size};
    `;

    const sheets = document.adoptedStyleSheets;
    const sheet = sheets[sheets.length - 1];

    tpl.attach(ctx, el);

    // Static rule exists before cleanup
    const staticSelector = `.${tpl.className}`;
    const ruleBefore = Array.from(sheet.cssRules).find((r) => (r as CSSStyleRule).selectorText === staticSelector);
    expect(ruleBefore).toBeTruthy();

    mountContext(ctx);
    cleanupContext(ctx);

    // Static rule still exists after cleanup
    const ruleAfter = Array.from(sheet.cssRules).find((r) => (r as CSSStyleRule).selectorText === staticSelector);
    expect(ruleAfter).toBeTruthy();
  });

  test("re-attach after cleanup does not error", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: ${() => "red"};
    `;

    tpl.attach(ctx, el);
    mountContext(ctx);
    cleanupContext(ctx);

    const ctx2 = createContext(null);
    const el2 = document.createElement("div");
    expect(() => tpl.attach(ctx2, el2)).not.toThrow();
  });
});

describe("css.when()", () => {
  test("returns a ConditionalTemplate", () => {
    const tpl = css`
      color: red;
    `;
    const result = tpl.when(true);
    expect(isConditionalTemplate(result)).toBe(true);
    expect(result.template).toBe(tpl);
    expect(result.condition).toBe(true);
  });

  test("attaches template when condition is true", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: red;
    `;
    tpl.when(true).template.attach(ctx, el, true);
    expect(el.classList.contains(tpl.className)).toBe(true);
  });

  test("does not attach template when condition is false", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: red;
    `;
    const conditional = tpl.when(false);
    conditional.template.attach(ctx, el, false);
    expect(el.classList.contains(tpl.className)).toBe(false);
  });
});
