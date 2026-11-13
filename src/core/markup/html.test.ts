import { describe, expect, test } from "vitest";
import type { Renderable } from "../../types";
import { html } from "./html.js";
import { createMarkup as m } from "./utils.js";

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

  test("props keep the type of an interpolated value", () => {
    const onClick = () => {};
    const style = { color: "red" };
    const parsed = html`<button tabindex=${3} disabled=${false} onclick=${onClick} style=${style} hidden />`;

    expect(parsed).toEqual(
      m("button", { tabindex: 3, disabled: false, onclick: onClick, style, hidden: true, children: [] } as any),
    );
    expect((parsed as any).props.onclick).toBe(onClick);
    expect((parsed as any).props.style).toBe(style);
  });

  test("props mixing text and values become strings", () => {
    const parsed = html`<a class="btn ${"primary"} wide" href=/users/${42} data-pair=${1}${2} title="plain text"></a>`;

    expect(parsed).toEqual(
      m("a", { class: "btn primary wide", href: "/users/42", "data-pair": "12", title: "plain text", children: [] }),
    );
  });

  test("spread props are applied in order with the props around them", () => {
    const parsed = html`<input type="text" ...${{ type: "email", name: "a" }} name="b" ...${{ id: "c" }} />`;

    expect(parsed).toEqual(m("input", { type: "email", name: "b", id: "c", children: [] }));
  });

  test("children can mix text, values and elements", () => {
    const getName = () => "Ada";
    const parsed = html`
      <p>
        Hello, ${getName}!
        <b>${1}${2}</b>
        <!-- a comment -->
        <br />
      </p>
    `;

    expect(parsed).toEqual(
      m("p", {
        children: ["Hello, ", getName, "!", m("b", { children: [1, 2] }), m("br", { children: [] })],
      }),
    );
  });

  test("a template with no elements returns its content", () => {
    expect(html`${5}`).toBe(5);
    expect(html``).toBeUndefined();
    expect(html`text`).toBe("text");
  });

  // A template is parsed once and filled in on every call, so calls must not share anything.
  describe("calling the same template again", () => {
    function row(View: any, id: number, label: string, rest: object) {
      return html`<${View} id=${id} class="row ${label}" ...${rest}><span>${label}</span> #${id}<//>` as any;
    }
    const First = () => null;
    const Second = () => null;

    test("uses the values of each call", () => {
      const a = row(First, 1, "one", { title: "a" });
      const b = row(Second, 2, "two", { hidden: true });

      expect(a).toEqual(
        m(First, { id: 1, class: "row one", title: "a", children: [m("span", { children: ["one"] }), " #", 1] }),
      );
      expect(b).toEqual(
        m(Second, { id: 2, class: "row two", hidden: true, children: [m("span", { children: ["two"] }), " #", 2] }),
      );
    });

    test("returns separate objects that can be changed independently", () => {
      const rest = { title: "a" };
      const a = row("div", 1, "one", rest);
      const b = row("div", 1, "one", rest);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.props).not.toBe(b.props);
      expect(a.props.children).not.toBe(b.props.children);
      expect(a.props.children[0]).not.toBe(b.props.children[0]);

      a.props.title = "changed";
      a.props.children.push("extra");
      expect(b.props.title).toBe("a");
      expect(b.props.children.length).toBe(3);
      expect(rest).toEqual({ title: "a" });
    });

    test("returns a new array of roots each time", () => {
      const roots = (n: number) =>
        html`<li>${n}</li>
          <li>${n + 1}</li>` as any[];
      const a = roots(1);
      const b = roots(5);

      expect(a).toEqual([m("li", { children: [1] }), m("li", { children: [2] })]);
      expect(b).toEqual([m("li", { children: [5] }), m("li", { children: [6] })]);
      expect(a).not.toBe(b);
    });
  });
});
