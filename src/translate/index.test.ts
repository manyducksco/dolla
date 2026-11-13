import { afterEach, describe, expect, test, vi } from "vitest";
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

  test("a slower earlier setLocale doesn't override a later one", async () => {
    let resolveFr!: (strings: { hello: string }) => void;
    const translator = await createTestTranslator({
      locale: "en",
      translations: {
        en: { hello: "Hello" },
        fr: () => new Promise((resolve) => (resolveFr = resolve)),
        ja: { hello: "こんにちは" },
      },
    });
    const hello = translator.t("hello");

    const fr = translator.setLocale("fr");
    await translator.setLocale("ja");
    expect(hello()).toBe("こんにちは");

    resolveFr({ hello: "Bonjour" });
    await fr;

    expect(translator.currentLocale()).toBe("ja");
    expect(hello()).toBe("こんにちは");
  });

  test("setLocale without a name falls back to the first locale when navigator has no languages", async () => {
    const languages = vi.spyOn(navigator, "languages", "get").mockReturnValue(undefined as any);
    try {
      const translator = await createTestTranslator({
        translations: { fr: { hello: "Bonjour" }, en: { hello: "Hello" } },
      });
      expect(translator.currentLocale()).toBe("fr");
    } finally {
      languages.mockRestore();
    }
  });

  test("ordinal option may be a getter", async () => {
    const { t } = await createTestTranslator({
      locale: "en",
      translations: { en: { place_one: "{{count}} place", place_ordinal_one: "{{count}}st place" } },
    });

    const [ordinal, setOrdinal] = createAtom(false);
    const place = t("place", { count: 1, ordinal });
    expect(place()).toBe("1 place");

    setOrdinal(true);
    expect(place()).toBe("1st place");
  });

  test("warns once about an unknown formatter and shows the value unformatted", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { t } = await createTestTranslator({
        locale: "en",
        translations: { en: { total: "Total: {{n|numbr}}", broken: "{{n|number(}}" } },
      });

      expect(t("total", { n: 5 })()).toBe("Total: 5");
      expect(t("total", { n: 6 })()).toBe("Total: 6");
      expect(t("broken", { n: 7 })()).toBe("7");

      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('"numbr"'))).toHaveLength(1);
      expect(messages.filter((m) => m.includes('"number("'))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  test("setLocale rejects a locale with no translations and keeps the current one", async () => {
    const translator = await createTestTranslator({
      locale: "en",
      translations: { en: { hello: "Hello" }, fr: { hello: "Bonjour" } },
    });

    await expect(translator.setLocale("xx")).rejects.toThrow("Locale 'xx' has no translation.");
    expect(translator.currentLocale()).toBe("en");
    expect(translator.t("hello")()).toBe("Hello");
  });

  test("setLocale without a name picks the first browser language with translations", async () => {
    const languages = vi.spyOn(navigator, "languages", "get").mockReturnValue(["de", "fr", "en"]);
    try {
      const translator = await createTestTranslator({
        translations: { en: { hello: "Hello" }, fr: { hello: "Bonjour" } },
      });
      expect(translator.currentLocale()).toBe("fr");

      languages.mockReturnValue(["de"]);
      await translator.setLocale();
      expect(translator.currentLocale()).toBe("en");
    } finally {
      languages.mockRestore();
    }
  });

  test("missing context or plural variants fall back to the base key", async () => {
    const { t } = await createTestTranslator({
      locale: "en",
      translations: {
        en: {
          greeting: "Hello",
          greeting_formal: "Good day",
          apples: "{{count}} apple(s)",
          pears_casual: "{{count}} pears, mate",
        },
      },
    });

    expect(t("greeting", { context: "pirate" })()).toBe("Hello");
    expect(t("apples", { count: 2 })()).toBe("2 apple(s)");
    expect(t("greeting", { context: "formal", count: 2 })()).toBe("Good day");
    expect(t("pears", { context: "casual", count: 2 })()).toBe("2 pears, mate");
    expect(t("missing", { context: "formal", count: 2 })()).toBe("missing");
  });
});

describe("format", () => {
  test("number keeps bigint precision", async () => {
    const { format } = await createTestTranslator({ locale: "en", translations: { en: {} } });
    expect(format("number", 12345678901234567890n)()).toBe("12,345,678,901,234,567,890");
  });

  test("datetime accepts dates, timestamps and date strings", async () => {
    const { format } = await createTestTranslator({ locale: "en", translations: { en: {} } });
    const options = { timeZone: "UTC", dateStyle: "medium" } as const;
    expect(format("datetime", new Date(Date.UTC(2026, 0, 2)), options)()).toBe("Jan 2, 2026");
    expect(format("datetime", Date.UTC(2026, 0, 2), options)()).toBe("Jan 2, 2026");
    expect(format("datetime", "2026-01-02T00:00:00Z", options)()).toBe("Jan 2, 2026");
  });

  test("built-in formatters check value and option types", async () => {
    const { format } = await createTestTranslator({
      locale: "en",
      translations: { en: {} },
      formatters: { shout: (_locale, value) => String(value).toUpperCase() },
    });
    const [count] = createAtom(3);
    const [maybe] = createAtom<number | undefined>(3);

    format("number", count, { style: "percent" });
    format("list", ["a", "b"], { type: "conjunction" });
    expect(format("shout", "hi")()).toBe("HI");

    // @ts-expect-error a string is not a number
    format("number", "5");
    // @ts-expect-error a number is not a list of strings
    format("list", [1, 2]);
    // @ts-expect-error dateStyle is not a number option
    format("number", 5, { dateStyle: "short" });
    // @ts-expect-error "percnt" is not a valid style
    format("number", 5, { style: "percnt" });
    // @ts-expect-error the getter may hold undefined
    format("number", maybe);
  });
});

// Constructing an Intl formatter costs far more than formatting with one.
describe("formatter reuse", () => {
  const restore: (() => void)[] = [];

  afterEach(() => {
    for (const fn of restore.splice(0)) fn();
  });

  /** Counts how many formatters of one kind are constructed from here on. */
  function countConstructed(kind: "NumberFormat" | "DateTimeFormat" | "ListFormat"): () => number {
    const intl = Intl as any;
    const Original = intl[kind];
    let count = 0;
    intl[kind] = class extends Original {
      constructor(...args: any[]) {
        super(...args);
        count++;
      }
    };
    restore.push(() => {
      intl[kind] = Original;
    });
    return () => count;
  }

  const translations = { en: { total: "{{n | number(minimumFractionDigits: 2)}}" }, de: { total: "{{n | number}}" } };

  test("formatting several values with equal options builds one formatter", async () => {
    const { format } = await createTestTranslator({ locale: "en", translations });
    const constructed = countConstructed("NumberFormat");

    const [n, setN] = createAtom(1);
    const first = format("number", n, { minimumFractionDigits: 2 });
    expect(first()).toBe("1.00");
    setN(2);
    expect(first()).toBe("2.00");
    // A separate call with its own, equal options object.
    expect(format("number", 3, { minimumFractionDigits: 2 })()).toBe("3.00");

    expect(constructed()).toBe(1);
  });

  test("a formatter in a template is built once across re-evaluations", async () => {
    const { t } = await createTestTranslator({ locale: "en", translations });
    const constructed = countConstructed("NumberFormat");

    const [n, setN] = createAtom(1);
    const total = t("total", { n });
    expect(total()).toBe("1.00");
    setN(2.5);
    expect(total()).toBe("2.50");

    expect(constructed()).toBe(1);
  });

  test("datetime and list formatters are reused too", async () => {
    const { format } = await createTestTranslator({ locale: "en", translations });
    const dates = countConstructed("DateTimeFormat");
    const lists = countConstructed("ListFormat");

    const options = { timeZone: "UTC", dateStyle: "medium" } as const;
    expect(format("datetime", Date.UTC(2026, 0, 2), options)()).toBe("Jan 2, 2026");
    expect(format("datetime", Date.UTC(2026, 0, 3), { ...options })()).toBe("Jan 3, 2026");
    expect(format("list", ["a", "b"])()).toBe("a and b");
    expect(format("list", ["c", "d", "e"])()).toBe("c, d, and e");

    expect(dates()).toBe(1);
    expect(lists()).toBe(1);
  });

  test("different options and locales get their own formatter", async () => {
    const { format, setLocale } = await createTestTranslator({ locale: "en", translations });

    const plain = format("number", 1234.5);
    const fixed = format("number", 1234.5, { minimumFractionDigits: 2 });
    const percent = format("number", 0.5, { style: "percent" });
    expect([plain(), fixed(), percent()]).toEqual(["1,234.5", "1,234.50", "50%"]);

    await setLocale("de");
    expect([plain(), fixed()]).toEqual(["1.234,5", "1.234,50"]);

    await setLocale("en");
    expect([plain(), fixed(), percent()]).toEqual(["1,234.5", "1,234.50", "50%"]);
  });
});

describe("locale caching", () => {
  const MINUTE = 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  function counted(strings: { hello: string }) {
    const fetch = vi.fn(async () => strings);
    return fetch;
  }

  test("switching back to a recently used locale doesn't fetch it again", async () => {
    const fr = counted({ hello: "Bonjour" });
    const translator = await createTestTranslator({ locale: "en", translations: { en: { hello: "Hello" }, fr } });
    const hello = translator.t("hello");

    await translator.setLocale("fr");
    await translator.setLocale("en");
    await translator.setLocale("fr");

    expect(fr).toHaveBeenCalledTimes(1);
    expect(hello()).toBe("Bonjour");
  });

  test("a failed load is not cached", async () => {
    const fr = vi
      .fn<() => Promise<{ hello: string }>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ hello: "Bonjour" });
    const translator = await createTestTranslator({ locale: "en", translations: { en: { hello: "Hello" }, fr } });

    await expect(translator.setLocale("fr")).rejects.toThrow("offline");
    await translator.setLocale("fr");

    expect(fr).toHaveBeenCalledTimes(2);
    expect(translator.t("hello")()).toBe("Bonjour");
  });

  test("a locale unused for over five minutes is fetched again", async () => {
    vi.useFakeTimers();
    const fr = counted({ hello: "Bonjour" });
    const translator = await createTestTranslator({ locale: "en", translations: { en: { hello: "Hello" }, fr } });

    await translator.setLocale("fr");
    await translator.setLocale("en");
    vi.advanceTimersByTime(4 * MINUTE);
    await translator.setLocale("fr");
    expect(fr).toHaveBeenCalledTimes(1);

    await translator.setLocale("en");
    vi.advanceTimersByTime(5 * MINUTE + 1);
    await translator.setLocale("fr");
    expect(fr).toHaveBeenCalledTimes(2);
    expect(translator.t("hello")()).toBe("Bonjour");
  });

  test("the current locale is never evicted", async () => {
    vi.useFakeTimers();
    const fr = counted({ hello: "Bonjour" });
    const translator = await createTestTranslator({ locale: "fr", translations: { en: { hello: "Hello" }, fr } });

    vi.advanceTimersByTime(60 * MINUTE);
    await translator.setLocale("en");
    await translator.setLocale("fr");

    expect(fr).toHaveBeenCalledTimes(1);
  });

  test("a locale that becomes current while its eviction is pending stays cached", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (strings: { hello: string }) => void;
    const fr = vi
      .fn<() => Promise<{ hello: string }>>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValue({ hello: "Bonjour" });
    const translator = await createTestTranslator({ locale: "en", translations: { en: { hello: "Hello" }, fr } });

    // The first call is superseded by the second, which shares its load.
    const first = translator.setLocale("fr");
    const second = translator.setLocale("fr");
    resolveFirst({ hello: "Bonjour" });
    await Promise.all([first, second]);
    expect(translator.currentLocale()).toBe("fr");

    vi.advanceTimersByTime(60 * MINUTE);
    await translator.setLocale("en");
    await translator.setLocale("fr");
    expect(fr).toHaveBeenCalledTimes(1);
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

  test("formatter options coerce booleans and numbers", () => {
    const segments = parseTemplate("{{n|number(useGrouping:false, minimumFractionDigits: 2, style: percent, x: true)}}");
    let capturedOptions: any;
    const formatters = new Map();
    formatters.set("number", (_locale: string, value: any, options: any) => {
      capturedOptions = options;
      return new Intl.NumberFormat("en", options).format(value);
    });
    const result = segments.map((s) => s({ n: 12345 }, formatters, "en")).join("");
    expect(capturedOptions).toEqual({ useGrouping: false, minimumFractionDigits: 2, style: "percent", x: true });
    expect(result).toBe("1234500.00%");
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
