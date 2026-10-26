import { describe, expect, test } from "vitest";
import { createAtom, createRoot } from "../core/index.js";
import { css } from "../core/markup/css.js";
import { IS_STYLED_VIEW } from "../core/markup/css-template.js";
import { html } from "../core/markup/html.js";
import { flushPendingUpdates } from "../core/markup/scheduler.js";
import { styled } from "./index.js";

function mount(target: Element, view: any, debug = false) {
  const root = createRoot(target, { debug });
  return root.mount(view);
}

function getStaticSheet(): CSSStyleSheet {
  return document.adoptedStyleSheets[document.adoptedStyleSheets.length - 1];
}

function norm(value: string): string {
  return value
    .replace(/\s*([:;{}])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function ruleText(selector: string): string {
  for (const rule of Array.from(getStaticSheet().cssRules)) {
    if ((rule as CSSStyleRule).selectorText === selector) {
      return norm((rule as CSSStyleRule).cssText);
    }
  }
  return "";
}

function ruleIndex(selector: string): number {
  const rules = Array.from(getStaticSheet().cssRules);
  for (let i = 0; i < rules.length; i++) {
    if ((rules[i] as CSSStyleRule).selectorText === selector) return i;
  }
  return -1;
}

function classNameOf(view: any): string {
  return view[IS_STYLED_VIEW].className;
}

describe("styled", () => {
  test("renders an intrinsic tag with a css-<hash> class", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Button = styled.button`
      color: red;
    `;

    await mount(target, () => html`<${Button}>Hi<//>`);

    const el = target.querySelector("button")!;
    expect(el.textContent).toBe("Hi");
    expect(el.className).toMatch(/^css-/);
    expect(ruleText(`.${el.className}`)).toContain("color:red");
  });

  test("does not change the class name when named", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const A = styled.div.named("A")`
      color: red;
    `;
    const B = styled.div.named("B")`
      color: red;
    `;

    expect(classNameOf(A)).toBe(classNameOf(B));
    expect(classNameOf(A)).toMatch(/^css-/);
    expect(A.name).toBe("Styled(A)");
    expect(B.name).toBe("Styled(B)");

    await mount(target, () => html`<${A} id="a" /><${B} id="b" />`);

    const a = target.querySelector("#a")!;
    const b = target.querySelector("#b")!;
    expect(a.getAttribute("class")).toBe(b.getAttribute("class"));
  });

  test("dedupes with an equivalent plain css template", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const plain = css`
      color: red;
    `;
    const Styled = styled.div`
      color: red;
    `;

    expect(classNameOf(Styled)).toBe(plain.className);

    await mount(
      target,
      () =>
        html`<div id="plain" class=${plain}></div>
          <${Styled} id="styled"><//>`,
    );

    expect(target.querySelector("#plain")!.getAttribute("class")).toBe(
      target.querySelector("#styled")!.getAttribute("class"),
    );
  });

  test("merges caller class and className", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Block = styled.div`
      color: red;
    `;

    await mount(
      target,
      () => html`<${Block} id="a" class="extra-a"></${Block}><${Block} id="b" className="extra-b"></${Block}>`,
    );

    const a = target.querySelector("#a")!;
    const b = target.querySelector("#b")!;
    expect(a.classList.contains(classNameOf(Block))).toBe(true);
    expect(a.classList.contains("extra-a")).toBe(true);
    expect(b.classList.contains(classNameOf(Block))).toBe(true);
    expect(b.classList.contains("extra-b")).toBe(true);
  });

  test("supports reactive class props", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const [getCount, setCount] = createAtom(0);
    const Block = styled.div`
      color: red;
    `;
    const getExtra = () => (getCount() > 0 ? "extra" : "");

    await mount(target, () => html`<${Block} class=${getExtra}>x<//>`);

    const el = target.querySelector("div")!;
    expect(el.classList.contains("extra")).toBe(false);

    setCount(1);
    flushPendingUpdates();

    expect(el.classList.contains("extra")).toBe(true);
  });

  test("binds getter interpolations as CSS variables", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const [hue, setHue] = createAtom(0);
    const Panel = styled.div`
      background: ${() => hue()};
    `;

    await mount(target, () => html`<${Panel}>x<//>`);

    const el = target.querySelector("div")!;
    const varName = `--${classNameOf(Panel)}-0`;
    expect(el.style.getPropertyValue(varName)).toBe("0");

    setHue(42);
    flushPendingUpdates();
    expect(el.style.getPropertyValue(varName)).toBe("42");
  });

  test("binds PropertyConfig interpolations", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const [hue, setHue] = createAtom(0);
    const Panel = styled.div`
      color: ${{ syntax: "<integer>", value: () => hue(), initialValue: 0, inherits: false }};
    `;

    await mount(target, () => html`<${Panel}>x<//>`);

    const el = target.querySelector("div")!;
    const varName = `--${classNameOf(Panel)}-0`;

    setHue(42);
    flushPendingUpdates();
    expect(el.style.getPropertyValue(varName)).toBe("42");
  });

  test("supports custom string tags", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Thing = styled["my-widget"]`
      color: red;
    `;
    const Called = styled("my-other-widget")`
      color: blue;
    `;

    await mount(target, () => html`<${Thing} id="a">x<//><${Called} id="b">y<//>`);

    expect(target.querySelector("my-widget")!.getAttribute("id")).toBe("a");
    expect(target.querySelector("my-other-widget")!.getAttribute("id")).toBe("b");
  });
});

describe("styled.named", () => {
  test("sets the View name shown by data-view in debug mode", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Block = styled.div.named("My Block")`
      color: red;
    `;

    await mount(target, () => html`<${Block}>x<//>`, true);

    expect(Block.name).toBe("Styled(My Block)");
    expect(target.querySelector("div")!.getAttribute("data-view")).toBe("Styled(My Block)");
  });

  test("does not mutate the original builder", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Base = styled.div;
    const Named = Base.named("Named");
    const A = Base`
      color: red;
    `;
    const B = Named`
      color: blue;
    `;

    await mount(target, () => html`<${A} id="a">x</${A}><${B} id="b">y</${B}>`);

    expect(A.name).toBe("Styled(div)");
    expect(B.name).toBe("Styled(Named)");
  });
});

describe("styled.as", () => {
  test("overrides the rendered tag for intrinsics", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Link = styled.button.as("a").named("Link")`
      color: red;
    `;

    await mount(target, () => html`<${Link}>x<//>`, true);

    const el = target.querySelector("a")!;
    expect(el).not.toBeNull();
    expect(target.querySelector("button")).toBeNull();
    expect(el.getAttribute("data-view")).toBe("Styled(Link)");
  });

  test("per-instance as wins over builder-level as", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Link = styled.button.as("a")`
      color: red;
    `;

    await mount(target, () => html`<${Link} as="span">x<//>`);

    expect(target.querySelector("span")).not.toBeNull();
    expect(target.querySelector("a")).toBeNull();
  });

  test("forwards as to a wrapped styled view", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Button = styled.button.named("Button")`
      color: red;
    `;
    const LinkButton = styled(Button).as("a").named("LinkButton")`
      color: blue;
    `;

    await mount(target, () => html`<${LinkButton}>x<//>`);

    const el = target.querySelector("a")!;
    expect(el).not.toBeNull();

    const classes = Array.from(el.classList).filter((c) => c.startsWith("css-"));
    expect(classes.length).toBe(2);

    // The wrapper's rule must come after the base rule.
    const baseClass = classes.find((c) => ruleText(`.${c}`).includes("color:red"))!;
    const wrapperClass = classes.find((c) => c !== baseClass)!;
    expect(ruleIndex(`.${wrapperClass}`)).toBeGreaterThan(ruleIndex(`.${baseClass}`));
  });
});

describe("styled wrapping views", () => {
  test("forwards class and as to a plain view", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Card = (props: any) => html`<article class=${props.class} data-as=${props.as ?? ""}>x</article>`;

    const StyledCard = styled(Card).named("Card").as("section")`
      color: red;
    `;

    await mount(target, () => html`<${StyledCard}>x<//>`);

    const el = target.querySelector("article")!;
    expect(el.classList.contains(classNameOf(StyledCard))).toBe(true);
    expect(el.getAttribute("data-as")).toBe("section");
  });
});

describe("styled selector interpolation", () => {
  test("uses the styled class name instead of rendering the view", async () => {
    const target = document.createElement("div");
    document.body.append(target);

    const Text = styled.span.named("Text")`
      color: red;
    `;

    const viaView = css`
      ${Text} {
        font-weight: bold;
      }
    `;
    const viaTemplate = css`
      ${(Text as any)[IS_STYLED_VIEW]} {
        font-weight: bold;
      }
    `;

    expect(viaView.className).toBe(viaTemplate.className);

    const Label = styled.label`
      &:hover ${Text} {
        opacity: 1;
      }
    `;

    await mount(target, () => html`<${Label}>x<//>`);

    const textClass = classNameOf(Text);
    const matching = Array.from(getStaticSheet().cssRules).filter((rule) =>
      norm((rule as CSSStyleRule).cssText).includes(`.${textClass}`),
    );
    expect(matching.length).toBeGreaterThanOrEqual(1);

    for (const rule of Array.from(getStaticSheet().cssRules)) {
      expect((rule as CSSStyleRule).style.cssText).not.toMatch(/\[object Object\]/);
    }
  });
});

describe("styled API surface", () => {
  test("does not expose a named class prefix on templates", () => {
    const Button = styled.button`
      color: red;
    `;
    const template = (Button as any)[IS_STYLED_VIEW];
    expect(template.className).toMatch(/^css-/);
    expect(template.named).toBeUndefined();
    expect(template.preinsert).toBeUndefined();
  });
});
