# Translate

In `translate.js`:

```js
import { createRoot, html } from "lmntl";
import { createTranslatePlugin, getTranslate } from "lmntl/translate";

function App() {
  const { t } = getTranslate(this);

  return <button onClick={() => alert("HELLO!")}>{t("helloButtonLabel")}</button>;
}

createRoot("#app")
  .plugin(
    createTranslatePlugin({
      locale: "en-US", // Load this locale by default.
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
