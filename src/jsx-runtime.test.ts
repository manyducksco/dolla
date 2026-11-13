import { describe, expect, test } from "vitest";
import { createRoot } from "./core/root.js";
import { isMarkup } from "./core/markup/utils.js";
import { jsxDEV, Fragment as DevFragment } from "./jsx-dev-runtime.js";
import { Fragment, jsx, jsxs } from "./jsx-runtime.js";

describe("jsx runtime", () => {
  test("creates markup for elements and views", () => {
    const View = () => null;
    expect(jsx("div", { id: "a" })).toEqual({ ...jsx("div", { id: "a" }), type: "div", props: { id: "a" } });
    expect(isMarkup(jsxs(View, { children: [] }))).toBe(true);
    expect(jsx(View, { a: 1 }).type).toBe(View);
  });

  test("adds a key to the props", () => {
    expect(jsx("li", { children: "x" }, "k").props).toEqual({ children: "x", key: "k" });
    expect(jsx("li", { children: "x" }, 0).props.key).toBe(0);
    expect("key" in jsx("li", { children: "x" }).props).toBe(false);
  });

  describe("Fragment", () => {
    test("is the same in the dev runtime", () => {
      expect(DevFragment).toBe(Fragment);
    });

    // A fragment only groups its children, so it needs no view of its own.
    test("produces its children instead of markup for a view", () => {
      const children = [jsx("span", { children: "a" }), "b"];
      expect(jsxs(Fragment, { children })).toBe(children);
      expect(jsx(Fragment, { children: "only" })).toBe("only");
      expect(jsx(Fragment, { children: "keyed" }, "k")).toBe("keyed");
      expect(jsx(Fragment, {})).toBeUndefined();
      expect(jsxDEV(Fragment, { children })).toBe(children);
    });

    test("renders its children in place", async () => {
      const container = document.createElement("div");
      const root = createRoot(container);
      await root.mount(() =>
        jsx("ul", {
          children: [
            jsx("li", { children: "first" }),
            jsxs(Fragment, {
              children: [jsx("li", { children: "a" }), jsx(Fragment, { children: jsx("li", { children: "b" }) })],
            }),
            jsx(Fragment, {}),
            jsx("li", { children: "last" }),
          ],
        }),
      );

      expect(container.innerHTML).toBe("<ul><li>first</li><li>a</li><li>b</li><li>last</li></ul>");
      root.unmount();
    });

    test("can be the root of a view", async () => {
      const container = document.createElement("div");
      const root = createRoot(container);
      await root.mount(() =>
        jsxs(Fragment, { children: [jsx("h1", { children: "Title" }), jsx("p", { children: "Body" })] }),
      );

      expect(container.innerHTML).toBe("<h1>Title</h1><p>Body</p>");
      root.unmount();
      expect(container.innerHTML).toBe("");
    });

    test("leaves its elements belonging to the surrounding view", async () => {
      const container = document.createElement("div");
      const root = createRoot(container, { debug: true });
      await root.mount(function Page() {
        return jsx(Fragment, { children: jsx("p", { children: "text" }) });
      });

      expect(container.querySelector("p")!.dataset.view).toBe("Page");
      root.unmount();
    });
  });
});
