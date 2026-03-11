# Translate

```js
// In translate.js

import { createTranslator } from "...";

export const { t, setLocale, currentLocale } = createTranslator({
  translations: {
    "en-US": {},
    ja: () => fetch("/locales/ja.json").then((res) => res.json()),
  },
});

// In views/App.js
import { t } from "../translate.js";

export function App() {
  // Use the `t` function to get translated strings. It returns a Getter<string>.
  return html`<button>${t("buttonLabel")}</button>`;
}

// In main.js
import { mount } from "@manyducks.co/dolla";
import { App } from "./views/App.js";
import { setLocale } from "./translate.js";

// Loads the translation and then mounts the app.
// You'll probably want a loader that the app will hide when it mounts to cover this time.
setLocale("en-US").then(() => {
  mount(App, document.body);
});
```
