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

  test("with composes child templates", () => {
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    parent.with(child);
    expect(parent.children.length).toBe(1);
    expect(parent.children[0][0]).toBe(child);
    expect(parent.children[0][1]).toBe(true);
  });

  test("with composes with condition", () => {
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    parent.with(child, false);
    expect(parent.children[0][1]).toBe(false);
  });

  test("attaching parent also attaches children", () => {
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
    expect(el.classList.contains(child.className)).toBe(true);
  });

  test("attaching parent with conditional child", () => {
    const ctx = createContext(null);
    const el = document.createElement("div");
    const parent = css`
      color: red;
    `;
    const child = css`
      font-weight: bold;
    `;
    parent.with(child, false);
    parent.attach(ctx, el);
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
