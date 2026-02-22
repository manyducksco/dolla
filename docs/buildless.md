# Dolla without a build step.

You're probably going to want to bundle with Vite for a big production app, but being able to drop a couple of script tags into an HTML file is great for a few scenarios:

- **Quick Prototypes & Demos:** You can spin up a demo in seconds. Perfect for CodePen, Glitch, or just a file on your desktop.
- **Learning:** It's a good way to learn Dolla without getting bogged down in build tool configuration, especially if you're new to web dev.
- **Embedding in Existing Sites:** Have a simple static site and just want to add a little island of reactivity without going overboard? Perfect.

## Enter `html`.

Dolla includes an `html` utility for writing JSX-like views without needing a compiler. Perfect when you want to drop in a script tag and spin up a quick demo or sprinkle in a bit of reactivity without taking over the whole page.

It's also a good way to learn Dolla without getting bogged down in build tools if you're just starting out in the world of web dev.

```html
<html>
  <head>
    <title>Look ma, no build step!</title>
  </head>
  <body>
    <main>
      <!-- ...the rest of the site... -->

      <div id="reactive-widget" />
    </main>

    <script type="module">
      import { dolla, state, html } from "https://esm.sh/@manyducks.co/dolla";

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

      dolla(Counter).mount("#reactive-widget");
    </script>
  </body>
</html>
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
