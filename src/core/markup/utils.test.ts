import { describe, test, expect } from "vitest";
import { isMarkup, isMarkupNode, createMarkup, render, toMarkupNodes } from "./utils";
import { ViewNode } from "./nodes/view";
import { DynamicNode } from "./nodes/dynamic";
import { Context } from "../context";
import { computed, state } from "../reactive";
import { DOMNode } from "./nodes/dom";
import { ElementNode } from "./nodes/element";

describe("type checking", () => {
  test("isMarkup", () => {
    const one = createMarkup("span", { children: "content" });
    const two = { type: "span", props: { children: "content" } };

    expect(isMarkup(one)).toBe(true);
    expect(isMarkup(two)).toBe(false);
  });

  test("isMarkupNode", () => {
    const context = new Context("test");
    const view = () => "hello";
    const one = new ViewNode(context, view, {});
    const two = new DynamicNode(
      context,
      computed(() => "hello"),
    );

    expect(isMarkupNode(view)).toBe(false);
    expect(isMarkupNode(one)).toBe(true);
    expect(isMarkupNode(two)).toBe(true);
  });
});

// test("render", () => {});

test("toMarkupNodes", () => {
  const count = state(5);

  const context = new Context("test");
  const nodes = toMarkupNodes(
    context,
    "one",
    document.createElement("div"),
    () => "hello",
    createMarkup("span", { children: "hi" }),
    count,
  );

  expect(nodes.length).toBe(5);
  expect(nodes[0]).toBeInstanceOf(DOMNode);
  expect(nodes[1]).toBeInstanceOf(DOMNode);
  expect(nodes[2]).toBeInstanceOf(DynamicNode);
  expect(nodes[3]).toBeInstanceOf(ElementNode);
  expect(nodes[4]).toBeInstanceOf(DynamicNode);
});
