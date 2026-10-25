import { describe, expect, test } from "vitest";
import { cleanupContext, createContext, mountContext } from "../context.js";
import { createAtom } from "../signals.js";
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

  test("equivalent static templates share one instance", () => {
    const first = css`
      display: flex;
      align-items: center;
    `;
    const second = css`
      display: flex;
      align-items: center;
    `;
    expect(first).toBe(second);
  });

  test("dynamic templates with the same hash are not shared", () => {
    const first = css`
      color: ${() => "red"};
    `;
    const second = css`
      color: ${() => "blue"};
    `;
    expect(first.className).toBe(second.className);
    expect(first).not.toBe(second);
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

describe("dynamic CSS bindings", () => {
  test("sets and updates inline custom properties", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const [color, setColor] = createAtom("red");
    const tpl = css`
      color: ${() => color()};
    `;
    const varName = `--${tpl.className}-0`;

    tpl.attach(ctx, el);
    mountContext(ctx);

    expect(el.classList.contains(tpl.className)).toBe(true);
    expect(el.style.getPropertyValue(varName)).toBe("red");

    setColor("blue");
    expect(el.style.getPropertyValue(varName)).toBe("blue");

    cleanupContext(ctx);
    expect(el.style.getPropertyValue(varName)).toBe("");
  });

  test("does not insert per-instance stylesheet rules", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const tpl = css`
      color: ${() => "red"};
    `;

    const sheets = document.adoptedStyleSheets;
    const sheet = sheets[sheets.length - 1];

    tpl.attach(ctx, el);

    const instanceRules = Array.from(sheet.cssRules).filter((r) =>
      (r as CSSStyleRule).selectorText?.startsWith(".css-instance-"),
    );
    expect(instanceRules.length).toBe(0);
  });

  test("removes the custom property when the value equals initialValue", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const [color, setColor] = createAtom("red");
    const tpl = css`
      color: ${{ syntax: "<color>", value: () => color(), initialValue: "red" }};
    `;
    const varName = `--${tpl.className}-0`;

    tpl.attach(ctx, el);
    mountContext(ctx);
    expect(el.style.getPropertyValue(varName)).toBe("");

    setColor("blue");
    expect(el.style.getPropertyValue(varName)).toBe("blue");

    setColor("red");
    expect(el.style.getPropertyValue(varName)).toBe("");
  });

  test("caches a template shape without sharing getters between instances", () => {
    const make = (getter: () => string) => css`
      color: ${getter};
    `;

    const red = make(() => "red");
    const blue = make(() => "blue");
    expect(red.className).toBe(blue.className);
    expect(red).not.toBe(blue);

    const ctxA = createContext(null);
    const elA = document.createElement("div");
    const ctxB = createContext(null);
    const elB = document.createElement("div");
    const varName = `--${red.className}-0`;

    red.attach(ctxA, elA);
    blue.attach(ctxB, elB);
    mountContext(ctxA);
    mountContext(ctxB);

    expect(elA.style.getPropertyValue(varName)).toBe("red");
    expect(elB.style.getPropertyValue(varName)).toBe("blue");
  });

  test("conditional templates still toggle the class and update values", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const [active, setActive] = createAtom(true);
    const [color, setColor] = createAtom("red");
    const tpl = css`
      color: ${() => color()};
    `;
    const varName = `--${tpl.className}-0`;

    tpl.attach(ctx, el, () => active());
    mountContext(ctx);

    expect(el.classList.contains(tpl.className)).toBe(true);
    expect(el.style.getPropertyValue(varName)).toBe("red");

    setActive(false);
    expect(el.classList.contains(tpl.className)).toBe(false);

    setColor("blue");
    expect(el.style.getPropertyValue(varName)).toBe("blue");
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

describe("hash collision prevention", () => {
  test("templates differing only in static primitive interpolation get distinct classNames", () => {
    const a = "20px";
    const b = "14px";
    const tplA = css`
      font-size: ${a};
    `;
    const tplB = css`
      font-size: ${b};
    `;
    expect(tplA.className).not.toBe(tplB.className);
  });

  test("templates differing only in numeric static interpolation get distinct classNames", () => {
    const tplA = css`
      z-index: ${10};
    `;
    const tplB = css`
      z-index: ${99};
    `;
    expect(tplA.className).not.toBe(tplB.className);
  });

  test("identical static interpolations still dedup (same className)", () => {
    const a = "20px";
    const tplA = css`
      font-size: ${a};
    `;
    const tplB = css`
      font-size: ${a};
    `;
    expect(tplA.className).toBe(tplB.className);
  });

  test("PropertyConfigs with different syntax get distinct classNames", () => {
    const cfgA = {
      syntax: "<color>",
      value: () => "red",
      initialValue: "red",
    } as const;
    const cfgB = {
      syntax: "<length>",
      value: () => "10px",
      initialValue: "10px",
    } as const;
    const tplA = css`
      color: ${cfgA};
    `;
    const tplB = css`
      padding: ${cfgB};
    `;
    // Different syntax → different static content → distinct classNames.
    expect(tplA.className).not.toBe(tplB.className);
  });

  test("PropertyConfigs differing only in initialValue get distinct classNames", () => {
    const cfgA = {
      syntax: "<color>",
      value: () => "red",
      initialValue: "red",
    } as const;
    const cfgB = {
      syntax: "<color>",
      value: () => "red",
      initialValue: "blue",
    } as const;
    const tplA = css`
      color: ${cfgA};
    `;
    const tplB = css`
      color: ${cfgB};
    `;
    expect(tplA.className).not.toBe(tplB.className);
  });

  test("reactive getter interpolations are still skipped from the hash (dedup preserved)", () => {
    const getColor = () => "red";
    const getOtherColor = () => "blue";
    const tplA = css`
      color: ${getColor};
    `;
    const tplB = css`
      color: ${getOtherColor};
    `;
    // Both functions render as `var(--css-XYZ-0)`; the template identity is
    // the same so they dedup.
    expect(tplA.className).toBe(tplB.className);
  });

  test("reactive getter vs static primitive interpolation produce distinct classNames", () => {
    const getColor = () => "red";
    const tplFn = css`
      color: ${getColor};
    `;
    const tplStatic = css`
      color: red;
    `;
    // Different static content (function skipped vs literal "red").
    expect(tplFn.className).not.toBe(tplStatic.className);
  });
});
