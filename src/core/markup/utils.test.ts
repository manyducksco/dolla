import { describe, expect, test } from "vitest";
import { createContext } from "../context";
import { createAtom } from "../signals";
import { DOMNode } from "./nodes/dom";
import { DynamicNode } from "./nodes/dynamic";
import { ElementNode } from "./nodes/element";
import { ViewNode } from "./nodes/view";
import { createMarkup, isMarkup, isMarkupNode, toMarkupNodes, camelToKebab } from "./utils";

describe("camelToKebab", () => {
  test("converts camelCase names", () => {
    expect(camelToKebab("fontSize")).toBe("font-size");
    expect(camelToKebab("backgroundColor")).toBe("background-color");
    expect(camelToKebab("borderTopLeftRadius")).toBe("border-top-left-radius");
  });

  test("returns stable results for repeated calls", () => {
    expect(camelToKebab("fillOpacity")).toBe("fill-opacity");
    expect(camelToKebab("fillOpacity")).toBe("fill-opacity");
  });
});

describe("type checking", () => {
  test("isMarkup", () => {
    const one = createMarkup("span", { children: "content" });
    const two = { type: "span", props: { children: "content" } };

    expect(isMarkup(one)).toBe(true);
    expect(isMarkup(two)).toBe(false);
  });

  test("isMarkupNode", () => {
    const context = createContext(null);
    const view = () => "hello";
    const one = new ViewNode(context, view, {});
    const two = new DynamicNode(context, () => "hello");

    expect(isMarkupNode(view)).toBe(false);
    expect(isMarkupNode(one)).toBe(true);
    expect(isMarkupNode(two)).toBe(true);
  });
});

// test("render", () => {});

test("toMarkupNodes", () => {
  const [count] = createAtom(5);

  const context = createContext(null);
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
