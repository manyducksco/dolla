import { describe, expect, test } from "vitest";
import { createAtom } from "../core/signals.js";
import { compile, createTranslate, getTranslate, parseTemplate, type TranslatorOptions } from "./index.js";

async function createTestTranslator(options: TranslatorOptions) {
  const context: any = {};
  await createTranslate(options)(context);
  return getTranslate(context);
}

describe("translator", () => {
  test("context option may be a getter", async () => {
    const { t } = await createTestTranslator({
      locale: "en",
      translations: { en: { greeting_formal: "Good day", greeting_casual: "Hey" } },
    });

    const [context, setContext] = createAtom("formal");
    const label = t("greeting", { context });
    expect(label()).toBe("Good day");

    setContext("casual");
    expect(label()).toBe("Hey");
  });

  test("exact-count keys work with a getter count", async () => {
    const { t } = await createTestTranslator({
      locale: "en",
      translations: {
        en: {
          "apples_(=0)": "no apples",
          apples_one: "{{count}} apple",
          apples_other: "{{count}} apples",
          "place_ordinal_(=1)": "winner",
          place_ordinal_two: "{{count}}nd",
          place_ordinal_other: "{{count}}th",
        },
      },
    });

    const [count, setCount] = createAtom(0);
    const apples = t("apples", { count });
    const place = t("place", { count, ordinal: true });
    expect(apples()).toBe("no apples");

    setCount(1);
    expect(apples()).toBe("1 apple");
    expect(place()).toBe("winner");

    setCount(2);
    expect(apples()).toBe("2 apples");
    expect(place()).toBe("2nd");

    setCount(0);
    expect(apples()).toBe("no apples");
  });

  test("nested plural and context objects resolve (README format)", async () => {
    const { t } = await createTestTranslator({
      locale: "en",
      translations: {
        en: {
          apples: { "(=0)": "no apples", one: "{{count}} apple", other: "{{count}} apples" },
          place: { ordinal_one: "{{count}}st", ordinal_other: "{{count}}th" },
          greeting: { formal: "Good day", casual: "Hey" },
          menu: { items: { one: "{{count}} item", other: "{{count}} items" } },
        },
      },
    });

    expect(t("apples", { count: 3 })()).toBe("3 apples");
    expect(t("apples", { count: 1 })()).toBe("1 apple");
    expect(t("apples", { count: 0 })()).toBe("no apples");
    expect(t("place", { count: 1, ordinal: true })()).toBe("1st");
    expect(t("greeting", { context: "formal" })()).toBe("Good day");
    expect(t("menu.items", { count: 2 })()).toBe("2 items");
  });
});

describe("parseTemplate", () => {
  test("static text returns single segment", () => {
    const segments = parseTemplate("hello world");
    expect(segments.length).toBe(1);
    expect(segments[0](undefined, new Map(), "en")).toBe("hello world");
  });

  test("simple placeholder replacement", () => {
    const segments = parseTemplate("Hello {{name}}!");
    expect(segments.length).toBe(3);
    const result = segments.map((s) => s({ name: "World" }, new Map(), "en")).join("");
    expect(result).toBe("Hello World!");
  });

  test("multiple placeholders", () => {
    const segments = parseTemplate("{{greeting}}, {{name}}!");
    const result = segments.map((s) => s({ greeting: "Hi", name: "Alice" }, new Map(), "en")).join("");
    expect(result).toBe("Hi, Alice!");
  });

  test("returns empty string for missing option", () => {
    const segments = parseTemplate("Value: {{missing}}");
    const result = segments.map((s) => s({}, new Map(), "en")).join("");
    expect(result).toBe("Value: ");
  });

  test("no options returns empty placeholder", () => {
    const segments = parseTemplate("{{key}}");
    expect(segments[0](undefined, new Map(), "en")).toBe("");
  });

  test("placeholder with number formatter", () => {
    const segments = parseTemplate("{{count|number}}");
    const formatters = new Map();
    formatters.set("number", (_locale: string, value: any) => String(value));
    const result = segments.map((s) => s({ count: 42 }, formatters, "en")).join("");
    expect(result).toBe("42");
  });

  test("placeholder with formatter options", () => {
    const segments = parseTemplate("{{price|currency(currency:USD)}}");
    let capturedOptions: any;
    const formatters = new Map();
    formatters.set("currency", (_locale: string, value: any, options: any) => {
      capturedOptions = options;
      return `$${value}`;
    });
    const result = segments.map((s) => s({ price: 100 }, formatters, "en")).join("");
    expect(result).toBe("$100");
    expect(capturedOptions).toEqual({ currency: "USD" });
  });

  test("empty template produces no segments", () => {
    const segments = parseTemplate("");
    expect(segments.length).toBe(0);
  });

  test("whitespace-only placeholder", () => {
    const segments = parseTemplate("  {{  key  }}  ");
    expect(segments.length).toBe(3);
    const result = segments.map((s) => s({ key: "val" }, new Map(), "en")).join("");
    expect(result).toBe("  val  ");
  });
});

describe("compile", () => {
  test("flattens a simple object", () => {
    const entries = compile({ hello: "Hello" });
    expect(entries.length).toBe(1);
    expect(entries[0][0]).toBe("hello");
  });

  test("flattens a nested object with dot-separated keys", () => {
    const entries = compile({
      greeting: {
        casual: "Hey",
        formal: "Hello",
      },
    });
    expect(entries.length).toBe(2);
    expect(entries[0][0]).toBe("greeting.casual");
    expect(entries[1][0]).toBe("greeting.formal");
  });

  test("deeply nested object", () => {
    const entries = compile({
      a: { b: { c: "deep" } },
    });
    expect(entries.length).toBe(1);
    expect(entries[0][0]).toBe("a.b.c");
    expect(
      entries[0][1].map((s) => s(undefined, new Map(), "en")).join(""),
    ).toBe("deep");
  });

  test("template placeholders are parsed in compiled output", () => {
    const entries = compile({ welcome: "Welcome, {{name}}!" });
    const result = entries[0][1]
      .map((s) => s({ name: "User" }, new Map(), "en"))
      .join("");
    expect(result).toBe("Welcome, User!");
  });

  test("empty object produces no entries", () => {
    const entries = compile({});
    expect(entries.length).toBe(0);
  });

  test("throws for non-string/non-object values", () => {
    expect(() =>
      compile({ key: 42 as any }),
    ).toThrow();
  });

  test("multiple top-level keys", () => {
    const entries = compile({
      title: "Title",
      description: "Description",
    });
    expect(entries.length).toBe(2);
    const keys = entries.map((e) => e[0]);
    expect(keys).toContain("title");
    expect(keys).toContain("description");
  });

  test("throws for null value", () => {
    expect(() => compile({ key: null as any })).toThrow();
  });

  test("throws for array value", () => {
    expect(() => compile({ key: [] as any })).toThrow();
  });
});
