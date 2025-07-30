# Going Buildless: The No-Stress Setup

Aight, so we've been talking about setting up Dolla with Vite, which is sick for real projects. But what if you just wanna vibe? What if you wanna throw together a quick demo on CodePen, or just mess around in a single HTML file without all the setup drama?

Bet. You can totally run Dolla **buildless**. No npm, no Vite, no `tsconfig.json`. Just you, a browser, and an HTML file.

The magic that makes this happen is a tiny library called [HTM (Hyperscript Tagged Markup)](https://github.com/developit/htm). It's basically JSX, but for the browser. It lets you write your UI using tagged template literals, which look a little weird at first but are actually super intuitive.

## The Setup: One HTML File to Rule Them All

Fr, this is all you need. Just create an `index.html` file and paste this in.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dolla Buildless Demo</title>
  </head>
  <body>
    <!-- Your app will go here! -->
    <div id="app"></div>

    <!-- This is the magic part -->
    <script type="module">
      // 1. Import what you need from a CDN
      import { createApp, useSignal, createMarkup } from "https://esm.sh/@manyducks.co/dolla";
      import htm from "https://esm.sh/htm";

      // 2. Tell HTM to use Dolla's markup function
      const html = htm.bind(createMarkup);

      // 3. Write your component using the `html` tag
      function App() {
        const [$count, setCount] = useSignal(0);

        return html`
          <div>
            <h1>Count: ${$count}</h1>
            <button onClick=${() => setCount((c) => c + 1)}>Click Me!</button>
          </div>
        `;
      }

      // 4. Mount your app into the #app element
      createApp(App).mount("#app");
    </script>
  </body>
</html>
```

Just save that file and open it in your browser. That's it. You have a fully reactive Dolla app running. No terminal, no `npm install`.

## How it Works: The `html` Tag

Let's break down the key part. This line:

```js
const html = htm.bind(createMarkup);
```

...is the secret sauce. It creates a special "tag" for your template literals. Whenever you write `html\`...\``, HTM intercepts it and, instead of making a normal string, it uses Dolla's `createMarkup\` function to turn it into the same Markup Nodes that JSX would create.

So, this JSX:

```jsx
<div class="greeting">Hello, {$name}</div>
```

Becomes this with HTM:

```js
html`<div class="greeting">Hello, ${$name}</div>`;
```

It's basically the same thing, just with a slightly different syntax. You use `${...}` to embed any JavaScript expression, whether it's a signal, a string, or an event handler.

## A More Complex Example

Let's see how our usual `Counter` example looks with HTM. It's almost identical.

```html
<script type="module">
  import { createApp, useSignal, useEffect, createMarkup } from "https://esm.sh/@manyducks.co/dolla";
  import { Show } from "https://esm.sh/@manyducks.co/dolla/views";
  import htm from "https://esm.sh/htm";

  const html = htm.bind(createMarkup);

  function Counter() {
    const [$count, setCount] = useSignal(0);

    useEffect(() => {
      console.log("The count is now:", $count());
    });

    return html`
      <div>
        <p>Count: ${$count}</p>
        <button onClick=${() => setCount((c) => c + 1)}>+1</button>

        {/* You can even use other components inside! */}
        <${Show} when=${() => $count() > 5}>
          <p>It's over 5!</p>
        <//>
      </div>
    `;
  }

  createApp(Counter).mount("#app");
</script>
```

The only weird part is using other components. You have to use the `${...}` syntax for the component itself, like `<${Show} ...>`. It's a little quirky, but you get used to it.

## So, Why Bother?

Going buildless is the main character for a few situations:

- **Quick Prototypes & Demos:** You can spin up a reactive demo in seconds. Perfect for CodePen, Glitch, or just a file on your desktop.
- **Learning:** It's a sick way to learn Dolla without getting bogged down in build tool configuration.
- **Embedding in Existing Sites:** Got a simple static site and just want to add a little island of reactivity? This is perfect.

For a huge, complex production app, you'll probably still want a build step with Vite for stuff like code splitting, bundling, and all that optimization. But for getting started or for smaller projects, going buildless is a total power move.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
