import { describe, expect, test, vi } from "vitest";
import { cleanupContext, createContext, mountContext } from "../context.js";
import { createAtom } from "../signals.js";
import { css, isConditionalTemplate, isCSSTemplate, keyframes } from "./css.js";
import { ElementNode } from "./nodes/element.js";
import { flushPendingUpdates } from "./scheduler.js";

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
    const insertRule = vi.spyOn(CSSStyleSheet.prototype, "insertRule");
    let rules: string[];
    try {
      tpl.attach(ctx, el);
      rules = insertRule.mock.calls.map((call) => call[0]);
    } finally {
      insertRule.mockRestore();
    }
    expect(el.classList.contains(tpl.className)).toBe(true);
    // The nested template is referenced by its class name.
    expect(rules.some((rule) => rule.includes(`.${base.className}`) && rule.includes("font-weight"))).toBe(true);
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
    expect(red.attach).toBe(blue.attach);
    expect(red.when).toBe(blue.when);

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

  test("PropertyConfig templates share a shape without sharing values", () => {
    const make = (value: string) => css`
      color: ${{ syntax: "<color>", value, initialValue: "red" }};
    `;

    const blue = make("blue");
    const green = make("green");
    expect(blue.className).toBe(green.className);
    expect(blue).not.toBe(green);

    const ctxA = createContext(null);
    const elA = document.createElement("div");
    const ctxB = createContext(null);
    const elB = document.createElement("div");
    const varName = `--${blue.className}-0`;

    blue.attach(ctxA, elA);
    green.attach(ctxB, elB);
    mountContext(ctxA);
    mountContext(ctxB);

    expect(elA.style.getPropertyValue(varName)).toBe("blue");
    expect(elB.style.getPropertyValue(varName)).toBe("green");
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

  test("templates differing only in the number of reactive getters get distinct classNames", () => {
    const a = () => "1px";
    const b = () => "2px";
    const one = css`margin: ${a}`;
    const two = css`margin: ${a} ${b}`;
    expect(one.className).not.toBe(two.className);
  });

  test("templates differing only in reactive getter position get distinct classNames", () => {
    const a = () => "1px";
    const before = css`margin: ${a} 0`;
    const after = css`margin: 0 ${a}`;
    expect(before.className).not.toBe(after.className);
  });

  test("a static interpolation does not shift the getter index of an equivalent literal template", () => {
    const width = () => "10px";
    const interpolated = css`color: ${"red"}; width: ${width};`;
    const literal = css`color: red; width: ${width};`;

    for (const tpl of [literal, interpolated]) {
      const ctx = createContext(null);
      const el = document.createElement("div");
      expect(() => {
        tpl.attach(ctx, el);
        mountContext(ctx);
      }).not.toThrow();
      const varNames = Array.from(el.style).filter((name) => name.startsWith(`--${tpl.className}`));
      expect(varNames.map((name) => el.style.getPropertyValue(name))).toEqual(["10px"]);
      cleanupContext(ctx);
    }
  });

  test.each([
    ["the shorter template first", false],
    ["the longer template first", true],
  ])("each template binds its own getters when built with %s", (_label, longFirst) => {
    const [a] = createAtom("1px");
    const [b] = createAtom("2px");
    const build = {
      one: () => css`padding: ${() => a()}`,
      two: () => css`padding: ${() => a()} ${() => b()}`,
    };
    const two = longFirst ? build.two() : undefined;
    const one = build.one();
    const tplTwo = two ?? build.two();

    const values = (tpl: typeof one) => {
      const ctx = createContext(null);
      const el = document.createElement("div");
      tpl.attach(ctx, el);
      mountContext(ctx);
      const result = Array.from(el.style)
        .filter((name) => name.startsWith(`--${tpl.className}`))
        .map((name) => el.style.getPropertyValue(name));
      cleanupContext(ctx);
      return result;
    };

    expect(values(one)).toEqual(["1px"]);
    expect(values(tplTwo)).toEqual(["1px", "2px"]);
  });

  test("different static templates whose source strings hash identically get distinct classNames", () => {
    // "Aa" and "BB" have the same 31-multiplier string hash.
    const tplA = css`content: "Aa";`;
    const tplB = css`content: "BB";`;
    expect(tplA.className).not.toBe(tplB.className);
  });
});

describe("detaching templates from an element", () => {
  test("disposes reactive bindings when a template is swapped out without unmounting", () => {
    const context = createContext(null);
    const container = document.createElement("div");
    const [on, setOn] = createAtom(true);
    const [color, setColor] = createAtom("red");
    let reads = 0;
    const readColor = () => {
      reads++;
      return color();
    };

    const node = new ElementNode(context, "div", {
      class: () => (on() ? css`color: ${readColor};` : "plain"),
    });
    node.mount(container);
    const el = container.children[0] as HTMLElement;

    for (let n = 0; n < 10; n++) {
      setOn(!on());
      flushPendingUpdates();
    }
    // 10 toggles from `true` ends back on `true`: exactly one live binding.
    expect(on()).toBe(true);

    reads = 0;
    setColor("blue");
    flushPendingUpdates();
    expect(reads).toBe(1);

    setOn(false);
    flushPendingUpdates();
    expect(el.getAttribute("style") ?? "").not.toContain("--css-");

    reads = 0;
    setColor("green");
    flushPendingUpdates();
    expect(reads).toBe(0);

    node.unmount();
  });

  test("swapping to a new instance of the same template keeps its class and value", () => {
    const context = createContext(null);
    const container = document.createElement("div");
    const [tick, setTick] = createAtom(0);
    const [color, setColor] = createAtom("red");

    const node = new ElementNode(context, "div", {
      class: () => {
        tick();
        // A new template instance with the same className on every run.
        return css`color: ${() => color()};`;
      },
    });
    node.mount(container);
    const el = container.children[0] as HTMLElement;
    const className = el.className;
    expect(className).toMatch(/^css-/);

    setTick(1);
    flushPendingUpdates();
    expect(el.classList.contains(className)).toBe(true);
    expect(el.style.getPropertyValue(`--${className}-0`)).toBe("red");

    setColor("blue");
    flushPendingUpdates();
    expect(el.style.getPropertyValue(`--${className}-0`)).toBe("blue");

    node.unmount();
  });
});

describe("at-rule extraction", () => {
  /** Attaches `tpl` and returns the rule texts it inserted into the stylesheet. */
  function insertedRules(tpl: ReturnType<typeof css>): string[] {
    const sheets = document.adoptedStyleSheets;
    const sheet = sheets[sheets.length - 1];
    const spy = vi.spyOn(sheet, "insertRule");
    try {
      tpl.attach(createContext(null), document.createElement("div"));
      return spy.mock.calls.map((call) => call[0].replace(/\s+/g, " ").trim());
    } finally {
      spy.mockRestore();
    }
  }

  test("a closing brace inside a string does not end a @keyframes block", () => {
    const tpl = css`
      @keyframes spin-brace { from { content: "}"; } to { content: "x"; } }
      color: red;
    `;
    const rules = insertedRules(tpl);
    expect(rules).toEqual([
      `@keyframes spin-brace { from { content: "}"; } to { content: "x"; } }`,
      `.${tpl.className}{ color: red; }`,
    ]);
  });

  test("an `@` inside a string is not treated as an at-rule", () => {
    const tpl = css`
      content: "@page";
      color: red;
    `;
    const rules = insertedRules(tpl);
    expect(rules).toEqual([`.${tpl.className}{ content: "@page"; color: red; }`]);
  });

  test("vendor-prefixed @keyframes are extracted", () => {
    const tpl = css`
      @-webkit-keyframes wk-spin { to { opacity: 0; } }
      color: red;
    `;
    const rules = insertedRules(tpl);
    expect(rules).toEqual([`@-webkit-keyframes wk-spin { to { opacity: 0; } }`, `.${tpl.className}{ color: red; }`]);
  });

  test("@keyframes inside @media keeps its media condition", () => {
    const tpl = css`
      color: red;
      @media (min-width: 600px) {
        color: blue;
        @keyframes grow-media { to { width: 10px; } }
      }
    `;
    const rules = insertedRules(tpl);
    expect(rules).toEqual([
      `@media (min-width: 600px) { @keyframes grow-media { to { width: 10px; } } }`,
      `.${tpl.className}{ color: red; @media (min-width: 600px) { color: blue; } }`,
    ]);
  });

  test("null, undefined and false static interpolations emit nothing", () => {
    const isLarge = false;
    const tpl = css`
      color: red;
      ${null}
      ${undefined}
      ${(isLarge && "font-size: 2em;") as any}
    `;
    const rules = insertedRules(tpl);
    expect(rules).toEqual([`.${tpl.className}{ color: red; }`]);
  });
});

describe("keyframes helper", () => {
  /** Runs `fn` and returns the rule texts it inserted into the stylesheet. */
  function rulesInsertedBy(fn: () => void): string[] {
    const sheets = document.adoptedStyleSheets;
    const sheet = sheets[sheets.length - 1];
    const spy = vi.spyOn(sheet, "insertRule");
    try {
      fn();
      return spy.mock.calls.map((call) => call[0].replace(/\s+/g, " ").trim());
    } finally {
      spy.mockRestore();
    }
  }

  test("registers a @keyframes rule under a generated name", () => {
    let fade!: ReturnType<typeof keyframes>;
    const rules = rulesInsertedBy(() => {
      fade = keyframes`from { opacity: 0; } to { opacity: 1; }`;
    });

    expect(fade.name).toMatch(/^kf-[a-z0-9]+(-\d+)?$/);
    expect(String(fade)).toBe(fade.name);
    expect(rules).toEqual([`@keyframes ${fade.name}{from { opacity: 0; } to { opacity: 1; }}`]);
  });

  test("a css template can reference the name", () => {
    const spin = keyframes`to { transform: rotate(360deg); }`;
    const tpl = css`
      animation: ${spin} 1s linear infinite;
    `;
    const rules = rulesInsertedBy(() => tpl.attach(createContext(null), document.createElement("div")));
    expect(rules).toEqual([`.${tpl.className}{ animation: ${spin.name} 1s linear infinite; }`]);
  });

  test("the same name in two templates no longer collides", () => {
    const a = keyframes`to { opacity: 0.25; }`;
    const b = keyframes`to { opacity: 0.75; }`;
    expect(a.name).not.toBe(b.name);

    const tplA = css`
      animation: ${a} 1s;
    `;
    const tplB = css`
      animation: ${b} 1s;
    `;
    expect(tplA.className).not.toBe(tplB.className);
  });

  test("identical keyframes share one name and one rule", () => {
    const rules = rulesInsertedBy(() => {
      const a = keyframes`to { width: 13px; }`;
      const b = keyframes`to { width: 13px; }`;
      expect(a.name).toBe(b.name);
    });
    expect(rules).toHaveLength(1);
  });

  test("static interpolations are part of the keyframes", () => {
    const to = (px: number) => keyframes`to { height: ${px}px; }`;
    const small = to(17);
    const large = to(41);
    expect(small.name).not.toBe(large.name);
    expect(to(17).name).toBe(small.name);
  });
});

describe("per-value class warning", () => {
  test("warns once when one call site keeps creating classes from static values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const sized = (n: number) => css`
        min-width: ${n}px;
      `;
      for (let n = 0; n < 120; n++) sized(1000 + n);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("min-width: ${…}px;");
      expect(String(warn.mock.calls[0][0])).toContain("getter");
    } finally {
      warn.mockRestore();
    }
  });

  test("getter interpolations never warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const sized = (n: number) => css`
        max-width: ${() => `${n}px`};
      `;
      for (let n = 0; n < 120; n++) sized(n);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test("reusing a few static values does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const tone = (color: string) => css`
        outline-color: ${color};
      `;
      for (let i = 0; i < 200; i++) tone(["red", "green", "blue"][i % 3]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test("classes from different call sites are counted separately", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const a = (n: number) => css`
        min-height: ${n}px;
      `;
      const b = (n: number) => css`
        max-height: ${n}px;
      `;
      for (let n = 0; n < 40; n++) {
        a(n);
        b(n);
      }
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
