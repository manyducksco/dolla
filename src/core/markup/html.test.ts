import { describe, test, expect } from "vitest";
import { html } from "./html.js";
import { createMarkup as m } from "./utils.js";
import { Renderable } from "../../types";

describe("html", () => {
  test("parses into Markup", () => {
    const parsed = html`<div><p>Hello</p></div>`;

    const expected = m("div", {
      children: [
        m("p", {
          children: ["Hello"],
        }),
      ],
    });

    expect(parsed).toEqual(expected);
  });

  test("supports multiple roots", () => {
    const parsed = html`
      <li>One</li>
      <li>Two</li>
    `;

    const expected = [
      m("li", {
        children: ["One"],
      }),
      m("li", {
        children: ["Two"],
      }),
    ];

    expect(parsed).toEqual(expected);
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

    const expected = m("div", {
      children: [
        m(TestView, {
          test: 1,
          children: [
            m("p", {
              children: ["hello"],
            }),
          ],
        }),
      ],
    });

    expect(parsed).toEqual(expected);
  });
});
