# Translate

In `translate.js`:

```js
import { createRoot, html } from "lmntl";
import { createTranslate, useTranslate } from "lmntl/translate";

function App() {
  const { t } = useTranslate(this);

  return <button onClick={() => alert("HELLO!")}>{t("helloButtonLabel")}</button>;
}

createRoot("#app")
  .plugin(
    createTranslate({
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
