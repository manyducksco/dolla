import { describe, expect, test, vi } from "vitest";
import { createContext } from "../context.js";
import { createAtom } from "../signals.js";
import { css, isCSSTemplate } from "./css.js";

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

  test("children array is empty by default", () => {
    const tpl = css`
      padding: 0;
    `;
    expect(tpl.children).toEqual([]);
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

  test("with returns a new template with the child appended", () => {
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    const combined = parent.with(child);
    expect(parent.children).toEqual([]);
    expect(combined.children.length).toBe(1);
    expect(combined.children[0][0]).toBe(child);
    expect(combined.children[0][1]).toBe(true);
  });

  test("with composes with condition", () => {
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    const combined = parent.with(child, false);
    expect(combined.children[0][1]).toBe(false);
  });

  test("with does not mutate the original template", () => {
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    const combined = parent.with(child);
    expect(combined).not.toBe(parent);
    expect(parent.children).toEqual([]);
    expect(combined.className).toBe(parent.className);
  });

  test("chained with calls accumulate children", () => {
    const parent = css`
      color: red;
    `;
    const a = css`
      font-weight: bold;
    `;
    const b = css`
      color: blue;
    `;
    const combined = parent.with(a).with(b);
    expect(combined.children.length).toBe(2);
    expect(combined.children[0][0]).toBe(a);
    expect(combined.children[1][0]).toBe(b);
  });

  test("attaching combined template also attaches children", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    const combined = parent.with(child);
    combined.attach(ctx, el);
    expect(el.classList.contains(combined.className)).toBe(true);
    expect(el.classList.contains(child.className)).toBe(true);
  });

  test("attaching parent without with() does not attach unrelated children", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    parent.with(child);
    parent.attach(ctx, el);
    expect(el.classList.contains(parent.className)).toBe(true);
    expect(el.classList.contains(child.className)).toBe(false);
  });

  test("attaching combined template with conditional child", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    const combined = parent.with(child, false);
    combined.attach(ctx, el);
    expect(el.classList.contains(child.className)).toBe(false);
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
