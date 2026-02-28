import { describe, test, expect } from "vitest";
import { html } from "./html.js";
import { createMarkup } from "./utils.js";
import { Renderable } from "../../types";

describe("html", () => {
  test("parses into Markup", () => {
    const parsed = html`<div><p>Hello</p></div>`;

    const expected = createMarkup("div", {
      children: [
        createMarkup("p", {
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
      createMarkup("li", {
        children: ["One"],
      }),
      createMarkup("li", {
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

    const expected = createMarkup("div", {
      children: [
        createMarkup(TestView, {
          test: 1,
          children: [
            createMarkup("p", {
              children: ["hello"],
            }),
          ],
        }),
      ],
    });

    expect(parsed).toEqual(expected);
  });
});
