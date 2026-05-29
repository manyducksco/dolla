# Translate

A simple i18n system. Put your translated strings in a JSON file and access them with the `t` function.

```js
import { createRoot, html } from "@manyducks.co/dolla";
import { createTranslate, getTranslate } from "@manyducks.co/dolla/translate";

function App() {
  const { t } = getTranslate(this);

  return html`<button onClick=${() => alert("HELLO!")}>${t("helloButtonLabel")}</button>`;
}

createRoot("#app")
  .plugin(
    createTranslate({
      locale: "en-US",
      translations: {
        "en-US": {
          helloButtonLabel: "Hello",
        },
        ja: () => fetch("/locales/ja.json").then((res) => res.json()),
      },
    }),
  )
  .mount(App);
```

## Features

### Template interpolation

Use `{{key}}` syntax to inject dynamic values:

```js
t("welcome", { name: "Alice" });
// "Hello, Alice!"
```

```json
{ "welcome": "Hello, {{name}}!" }
```

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
```

### Context-aware keys

Append `_context` to a key to select locale-specific variants:

```js
t("greeting", { context: "formal" });
// Selects key "greeting_formal" if it exists
```

### Built-in formatters

Pipe values through formatters using `|`:

```js
t("created", { date: "2024-01-15" });
// "Created: Jan 15, 2024" (when template is "Created: {{date|datetime}}")
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
    uppercase: (locale, value) => String(value).toUpperCase(),
  },
});
```

### Async translation loading

Pass a fetch function instead of a static object:

```js
createTranslate({
  translations: {
    "en-US": { hello: "Hello" },
    fr: () => fetch("/locales/fr.json").then((r) => r.json()),
  },
});
```

### Reactive `t()`

The `t()` function returns a `Getter<string>` that automatically updates whenever the locale changes.

```js
const { t } = getTranslate(this);
const label = t("hello"); // Getter<string>
```

### API

#### `createTranslate(options)`

Creates a DollaPlugin for internationalization.

| Option | Type | Default | Description |
|---|---|---|---|
| `translations` | `Record<string, LocalizedStrings \| () => LocalizedStrings \| Promise<LocalizedStrings>>` | — | Locale-keyed translation objects or async fetch functions. |
| `locale` | `string` | browser default | Initial locale to load. |
| `formatters` | `Record<string, Formatter>` | — | Custom formatter functions. |

#### `getTranslate(context)`

Returns a `Translator` API object:

| Method | Description |
|---|---|
| `t(selector, options?)` | Returns a `Getter<string>` for the translated string. |
| `setLocale(name?)` | Switches the current locale. |
| `currentLocale` | Getter for the current locale string. |
| `supportedLocales` | Array of available locale codes. |
| `format(name, value, options?)` | Applies a named formatter to a value. |

#### `compile(strings, path?)`

Compiles translation objects into reusable template arrays. Useful for pre-processing translation files.
