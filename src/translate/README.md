# Translate

A simple i18n system. Put your translated strings in a JSON file and access them with the `t` function.

```jsx
import { createRoot } from "@manyducks.co/dolla";
import { createTranslate, getTranslate } from "@manyducks.co/dolla/translate";

function App(props, context) {
  const { t } = getTranslate(context);

  return <button onClick={() => alert("HELLO!")}>{t("helloButtonLabel")}</button>;
}

await createRoot("#app")
  .plugin(
    createTranslate({
      locale: "en-US",
      translations: {
        "en-US": {
          helloButtonLabel: "Hello",
        },
        ja: () => fetch("/locales/ja.json").then((response) => response.json()),
      },
    }),
  )
  .mount(App);
```

## Features

### Template interpolation

Use `{{key}}` syntax to inject dynamic values:

```js
const getGreeting = t("welcome", { name: "Alice" });
getGreeting(); // "Hello, Alice!"

// In a template, pass the getter directly:
<p>{t("welcome", { name: "Alice" })}</p>;
```

```json
{ "welcome": "Hello, {{name}}!" }
```

Options values may be getters, so `t("welcome", { name: getUserName })` stays reactive when the name changes.

### Pluralization

Pass a `count` option — the translator uses `Intl.PluralRules` to select the correct form:

```js
const translations = {
  "en-US": {
    apples: {
      one: "{{count}} apple",
      other: "{{count}} apples",
    },
  },
};

t("apples", { count: 3 })(); // "3 apples"
```

`count` may be a getter. Exact-number keys (`apples_(=2)`) and ordinal keys (`apples_ordinal_one`) are also supported.

### Context-aware keys

Append `_context` to a key to select locale-specific variants:

```js
t("greeting", { context: "formal" })();
// Selects key "greeting_formal" if it exists
```

### Built-in formatters

Pipe values through formatters using `|`:

```js
t("created", { date: "2024-01-15" })();
// "Created: Jan 15, 2024" (when the template is "Created: {{date|datetime}}")
```

Available built-in formatters:

- `{{value|number}}` — uses `Intl.NumberFormat`
- `{{value|datetime}}` — uses `Intl.DateTimeFormat`
- `{{value|list}}` — uses `Intl.ListFormat`

### Custom formatters

Register custom formatters in the plugin options:

```js
createTranslate({
  formatters: {
    uppercase: (locale, value, options) => String(value).toUpperCase(),
  },
});
```

### Async translation loading

Pass a fetch function instead of a static object:

```js
createTranslate({
  translations: {
    "en-US": { hello: "Hello" },
    fr: () => fetch("/locales/fr.json").then((response) => response.json()),
  },
});
```

The initial locale is loaded when the plugin runs. `createRoot(...).mount(...)` awaits it, so the app does not mount until the starting locale is ready.

`setLocale(name?)` is async. Await it if you need to know when the new locale is available:

```js
const { setLocale } = getTranslate(context);

try {
  await setLocale("fr");
} catch (error) {
  console.error("Could not load French", error);
}
```

If the requested locale has no translations, `setLocale` rejects. A failed translation fetch also rejects.

### Reactive `t()`

The `t()` function returns a `Getter<string>` that automatically updates whenever the locale (or a reactive option) changes.

```jsx
function App(props, context) {
  const { t } = getTranslate(context);
  const getLabel = t("hello");

  return <p>{getLabel}</p>; // reactive
}
```

`getLabel()` returns the current string outside a template.

### API

#### `createTranslate(options)`

Creates a DollaPlugin for internationalization.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `translations` | `Record<string, LocalizedStrings \| () => LocalizedStrings \| Promise<LocalizedStrings>>` | — | Locale-keyed translation objects or async fetch functions. |
| `locale` | `string` | browser default | Initial locale to load. |
| `formatters` | `Record<string, Formatter>` | — | Custom formatter functions. |

#### `getTranslate(context)`

Returns a `Translator` API object:

| Method | Description |
| --- | --- |
| `t(selector, options?)` | Returns a `Getter<string>`. Options: `count`, `ordinal`, `context`, and interpolation values. Values may be getters. |
| `setLocale(name?)` | Switches the current locale. Returns a `Promise<void>`. |
| `currentLocale` | Getter for the current locale string. |
| `supportedLocales` | Array of available locale codes. |
| `format(name, value, options?)` | Returns a `Getter<string>` for a formatted value. `value` may be a getter. |

#### `compile(strings, path?)`

Compiles translation objects into reusable template arrays. Useful for pre-processing translation files.

```js
import { compile } from "@manyducks.co/dolla/translate";

const entries = compile({
  greeting: "Hello, {{name}}!",
  apples: {
    one: "{{count}} apple",
    other: "{{count}} apples",
  },
});
```

`compile` returns `[key, segments]` entries. This is the same representation the translator uses internally; most apps do not need it.
