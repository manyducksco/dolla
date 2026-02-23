import { describe, test, expect } from "vitest";
import { html } from "./html";
import { Markup } from "./markup";
import { Renderable } from "../types";

describe("html", () => {
  test("parses into Markup", () => {
    const parsed = html`<div><p>Hello</p></div>`;

    expect(parsed).toEqual(
      new Markup("div", {
        children: [
          new Markup("p", {
            children: ["Hello"],
          }),
        ],
      }),
    );
  });

  test("supports multiple roots", () => {
    const parsed = html`
      <li>One</li>
      <li>Two</li>
    `;

    expect(parsed).toEqual([
      new Markup("li", {
        children: ["One"],
      }),
      new Markup("li", {
        children: ["Two"],
      }),
    ]);
  });

  test("supports views", () => {
    interface TestViewProps {
      children: Renderable;
      test: number;
    }

    function TestView(props: TestViewProps) {
      return props.children;
    }

    const parsed = html`
      <div>
        <${TestView} test=${1}>
          <p>hello</p>
        <//>
      </div>
    `;

    expect(parsed).toEqual(
      new Markup("div", {
        children: [
          new Markup(TestView, {
            test: 1,
            children: [
              new Markup("p", {
                children: ["hello"],
              }),
            ],
          }),
        ],
      }),
    );
  });
});
