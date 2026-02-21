# Dolla without a build step.

You're probably going to want to bundle with Vite for a big production app, but being able to drop a couple of script tags into an HTML file is great for a few scenarios:

- **Quick Prototypes & Demos:** You can spin up a demo in seconds. Perfect for CodePen, Glitch, or just a file on your desktop.
- **Learning:** It's a good way to learn Dolla without getting bogged down in build tool configuration, especially if you're new to web dev.
- **Embedding in Existing Sites:** Have a simple static site and just want to add a little island of reactivity without going overboard? Perfect.

## Enter `htm`.

JSX is the main feature that needs a build step. Fortunately you can use the [`htm`](https://github.com/developit/htm) library for a more JSX-like experience. It binds to the `createMarkup` function (the same one JSX is calling under the hood) and enables you to write your views with tagged template literals.

```html
<html>
  <head>
    <title>Look ma, no build step!</title>
  </head>
  <body>
    <div id="app"></div>

    <script type="module">
      import { dolla, state, createMarkup } from "https://esm.sh/@manyducks.co/dolla";
      import htm from "https://esm.sh/htm";

      const html = htm.bind(createMarkup);

      function Layout({ children }) {
        return html`<div class="flex flex-col gap-2 p-8 rounded-xl bg-stone-300">${children}</div>`;
      }

      function Counter() {
        const count = state(0);

        return html`
          <${Layout}>
            <span>Count is: ${count}</span>
            <button onClick=${() => count.update((c) => c + 1)}>Increment</button>
          <//>
        `;
      }

      dolla(Counter).mount("#app");
    </script>
  </body>
</html>
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
