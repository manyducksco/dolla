import { describe, expect, test } from "vitest";
import { compose, createAtom, createRoot } from "../index.js";
import { css } from "./css.js";
import { html } from "./html.js";
import { styled } from "./styled.js";

function mount(target: Element, view: any) {
  const root = createRoot(target, { debug: false });
  return root.mount(view);
}

function getStaticSheet(): CSSStyleSheet {
  return document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1];
}

/** Normalises a CSS rule's cssText so whitespace doesn't trip assertions. */
function norm(s: string): string {
  return s.replace(/\s*([:;{}])\s*/g, "$1").replace(/\s+/g, " ").trim();
}

function ruleText(sheet: CSSStyleSheet, selector: string): string {
  for (const rule of Array.from(sheet.cssRules)) {
    if ((rule as CSSStyleRule).selectorText === selector) {
      return norm((rule as CSSStyleRule).cssText);
    }
  }
  return "";
}

function ruleIndex(sheet: CSSStyleSheet, selector: string): number {
  const rules = Array.from(sheet.cssRules);
  for (let i = 0; i < rules.length; i++) {
    if ((rules[i] as CSSStyleRule).selectorText === selector) return i;
  }
  return -1;
}

function instanceVarValue(varName: string): string {
  let last = "";
  for (const sheet of document.adoptedStyleSheets) {
    for (const rule of Array.from(sheet.cssRules)) {
      const style = (rule as CSSStyleRule).style;
      const val = style?.getPropertyValue(varName);
      if (val) last = val.trim();
    }
  }
  return last;
}

describe("styled.tag", () => {
  test("produces a function component that renders the tag with a styled class", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Button = styled.button`
      color: red;
    `;

    await mount(target, () => html`<${Button}>Hi<//>`);

    const el = target.querySelector("button");
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("Hi");

    const className = el!.getAttribute("class") ?? "";
    expect(className).toMatch(/^css-/);
    expect(ruleText(getStaticSheet(), `.${className}`)).toContain("color:red");
  });

  test("same static template shares one class across instances", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Box = styled.div`
      padding: 4px;
    `;

    await mount(target, () => html`<${Box} id="a" /><${Box} id="b" />`);

    const a = target.querySelector("#a")!;
    const b = target.querySelector("#b")!;
    expect(a.getAttribute("class")).toBe(b.getAttribute("class"));
  });

  test("function interpolation receives props and unwraps getters", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Panel = styled.div`
      color: ${(p) => p.color};
    `;

    await mount(target, () => html`<${Panel} color="orange">x<//>`);

    const el = target.querySelector("div")!;
    const className = el.getAttribute("class")!.split(" ").find((c) => c.startsWith("css-"))!;

    expect(ruleText(getStaticSheet(), `.${className}`)).toContain(`var(--${className}-0)`);
    expect(instanceVarValue(`--${className}-0`)).toBe("orange");
  });

  test("signal-driven prop update re-evaluates the binding", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const [color, setColor] = createAtom<string>("red");
    const Panel = styled.div`
      color: ${(p) => p.color};
    `;

    await mount(target, () => html`<${Panel} color=${color}>x<//>`);

    const el = target.querySelector("div")!;
    const className = el.getAttribute("class")!.split(" ").find((c) => c.startsWith("css-"))!;
    const varName = `--${className}-0`;

    expect(instanceVarValue(varName)).toBe("red");

    setColor("blue");
    await Promise.resolve();
    await Promise.resolve();
    expect(instanceVarValue(varName)).toBe("blue");
  });

  test("`as` overrides the rendered tag for intrinsics", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Block = styled.div`
      color: red;
    `;

    await mount(target, () => html`<${Block} as="span">x<//>`);

    expect(target.querySelector("span")).not.toBeNull();
    expect(target.querySelector("div")).toBeNull();
  });

  test("caller-supplied class is merged with the styled class", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Block = styled.div`
      color: red;
    `;

    await mount(target, () => html`<${Block} class="extra">x<//>`);

    const el = target.querySelector("div")!;
    const classes = el.getAttribute("class")!.split(" ").sort();
    expect(classes).toContain("extra");
    expect(classes.find((c) => c.startsWith("css-"))).toBeTruthy();
  });

  test("wrapping another styled view composes classes; override wins ties", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Base = styled.button`
      color: red;
      background: white;
    `;
    const Override = styled(Base)`
      color: blue;
    `;

    await mount(target, () => html`<${Override}>x<//>`);

    const el = target.querySelector("button")!;
    const styledClasses = Array.from(el.classList).filter((c) => c.startsWith("css-"));
    expect(styledClasses.length).toBe(2);

    // The override rule should appear AFTER the base rule in the sheet, so it
    // wins specificity ties (same selector specificity, later cascade order).
    const baseClass = styledClasses.find((c) => ruleText(getStaticSheet(), `.${c}`).includes("background"))!;
    const overrideClass = styledClasses.find((c) => c !== baseClass)!;
    expect(ruleIndex(getStaticSheet(), `.${baseClass}`)).toBeGreaterThanOrEqual(0);
    expect(ruleIndex(getStaticSheet(), `.${overrideClass}`)).toBeGreaterThan(ruleIndex(getStaticSheet(), `.${baseClass}`));

    // The override's color rule exists and contains "blue".
    expect(ruleText(getStaticSheet(), `.${overrideClass}`)).toContain("color:blue");
  });

  test("static string interpolation is inlined", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const size = "14px";
    const Text = styled.span`
      font-size: ${size};
    `;

    await mount(target, () => html`<${Text}>x<//>`);

    const el = target.querySelector("span")!;
    const className = el.getAttribute("class")!.split(" ").find((c) => c.startsWith("css-"))!;
    expect(ruleText(getStaticSheet(), `.${className}`)).toContain("font-size:14px");
  });

  test("custom string tag via styled('my-thing') works through the proxy", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Thing = styled("my-thing")`
      color: red;
    `;

    await mount(target, () => html`<${Thing}>x<//>`);

    expect(target.querySelector("my-thing")).not.toBeNull();
  });

  test("css tagged template still has preinsert (backward compat)", () => {
    const tpl = css`
      color: red;
    `;
    expect(typeof tpl.preinsert).toBe("function");
    expect(() => tpl.preinsert()).not.toThrow();
  });
});

describe("TemplateFn.named", () => {
  test("renames the class prefix to <name>-<hash>", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const MyButton = styled.button.named("MyButton")`
      color: red;
    `;

    await mount(target, () => html`<${MyButton}>x<//>`);

    const el = target.querySelector("button")!;
    const styledClasses = Array.from(el.classList).filter((c) => !["extra"].includes(c));
    expect(styledClasses.some((c) => c.startsWith("MyButton-"))).toBe(true);
    expect(ruleText(getStaticSheet(), `.${styledClasses[0]}`)).toContain("color:red");
  });

  test("hash is preserved across named and unnamed variants of the same statics", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Unnamed = styled.button`
      color: red;
    `;
    const Named = styled.button.named("MyButton")`
      color: red;
    `;

    await mount(target, () => html`<${Unnamed} id="u" /><${Named} id="n" />`);

    const uClass = target.querySelector("#u")!.getAttribute("class")!;
    const nClass = target.querySelector("#n")!.getAttribute("class")!;
    const uHash = uClass.match(/css-(\w+)/)?.[1];
    const nHash = nClass.match(/MyButton-(\w+)/)?.[1];
    expect(uHash).toBeTruthy();
    expect(nHash).toBe(uHash);
  });
});

describe("TemplateFn.as (tag override)", () => {
  test("renders the overridden tag for an intrinsic base", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Link = styled.button.as("a")`
      color: red;
    `;

    await mount(target, () => html`<${Link}>x<//>`);

    expect(target.querySelector("a")).not.toBeNull();
    expect(target.querySelector("button")).toBeNull();
  });

  test("chains .as(\"a\") with .named(\"MyLink\")", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const MyLink = styled.button.as("a").named("MyLink")`
      color: red;
    `;

    await mount(target, () => html`<${MyLink}>x<//>`);

    const el = target.querySelector("a")!;
    expect(el).not.toBeNull();
    expect(el.getAttribute("class")!.split(" ").some((c) => c.startsWith("MyLink-"))).toBe(true);
  });

  test("per-instance `as` prop wins over builder-level .as()", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Link = styled.button.as("a")`
      color: red;
    `;

    await mount(target, () => html`<${Link} as="span">x<//>`);

    expect(target.querySelector("span")).not.toBeNull();
    expect(target.querySelector("a")).toBeNull();
  });

  test("per-instance `as` prop overrides intrinsic tag with no builder .as()", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Block = styled.button`
      color: red;
    `;

    await mount(target, () => html`<${Block} as="section">x<//>`);

    expect(target.querySelector("section")).not.toBeNull();
    expect(target.querySelector("button")).toBeNull();
  });

  test("forwards `as` down to a wrapped styled view", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Button = styled.button`
      color: red;
    `;
    const LinkButton = styled(Button).as("a")`
      color: blue;
    `;

    await mount(target, () => html`<${LinkButton}>x<//>`);

    const el = target.querySelector("a")!;
    expect(el).not.toBeNull();
    expect(el.getAttribute("class")!.split(" ").filter((c) => c.startsWith("css-")).length).toBe(2);
  });

  test("chain order is irrelevant (.named after .as)", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const MyLink = styled.button.named("MyLink").as("a")`
      color: red;
    `;

    await mount(target, () => html`<${MyLink}>x<//>`);

    const el = target.querySelector("a")!;
    expect(el).not.toBeNull();
    expect(el.getAttribute("class")!.split(" ").some((c) => c.startsWith("MyLink-"))).toBe(true);
  });

  test("interpolating a StyledView inlines its class name as a CSS selector", async () => {
    const Text = styled.span`
      color: red;
    `;

    // StyledView should expose its underlying CSSTemplate
    const textTemplate = (Text as any).__cssTemplate;
    expect(textTemplate).toBeDefined();

    // Interpolating the StyledView should produce the same hash
    // as interpolating the raw CSSTemplate.
    const tplViaView = css`
      ${Text} { font-weight: bold; }
    `;
    const tplViaTemplate = css`
      ${textTemplate} { font-weight: bold; }
    `;

    expect(tplViaView.className).toBe(tplViaTemplate.className);
  });
});