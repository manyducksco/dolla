# Dolla Setup Guide: Let's Get Cookin'

Aight, so you're ready to build something sick with Dolla. Bet. This guide will get you from zero to a running "Hello World" app in just a few minutes.

We're gonna use [Vite](https://vitejs.dev/) as our build tool. It's fast af, super easy to set up, and it works perfectly with Dolla's JSX.

## Step 1: Make a New Vite Project

First things first, you need a place for your project to live. Pop open your terminal and run this command:

```bash
npm create vite@latest
```

Vite will ask you a few questions. Here's what you should pick:

1.  **Project name:** Go wild. Let's use `my-dolla-app` for this guide.
2.  **Select a framework:** Choose **Vanilla**. (Yeah, I know, but trust the process. We're adding Dolla ourselves).
3.  **Select a variant:** Choose **TypeScript** (or JavaScript if that's more your vibe).

Once it's done, hop into your new project directory:

```bash
cd my-dolla-app
```

## Step 2: Install Dolla

Now that you're in your project, you just need to install Dolla from npm.

```bash
npm install @manyducks.co/dolla
```

This will add Dolla to your `package.json` and `node_modules`.

## Step 3: Set Up JSX

You're gonna want to write JSX, right? It's way better than trying to write UI with just functions. To make it work, you just need to tell TypeScript (or JavaScript) how to handle it.

Open up your `tsconfig.json` file (or `jsconfig.json` if you're using plain JS) and add these two lines to the `compilerOptions`:

```json
{
  "compilerOptions": {
    // ... a bunch of other options will be here ...

    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

- `"jsx": "react-jsx"` tells the compiler to use the modern JSX transform.
- `"jsxImportSource": "@manyducks.co/dolla"` tells it to use Dolla's functions when it sees JSX, not React's.

Vite will see this and automatically know what to do. No extra plugins needed. It's a whole vibe.

## Step 4: Write Your First Component

Okay, time for the fun part. Let's clear out the default Vite stuff and write a real Dolla component.

Open up the main file at `src/main.ts` (or `main.js`) and replace everything in it with this:

```jsx
import { createApp, useSignal } from "@manyducks.co/dolla";

// This is our main View component!
function App() {
  const [$message, setMessage] = useSignal("Hello, Dolla!");

  return (
    <div>
      <h1>{$message}</h1>
      <p>Welcome to your new app.</p>
    </div>
  );
}

// This is how we tell Dolla to start up.
// It builds your App component and sticks it into the #app element.
createApp(App).mount("#app");
```

## Step 5: Peep Your HTML

Vite gives you a basic `index.html` in the root of your project. It'll look something like this:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + TS</title>
  </head>
  <body>
    <div id="app">
      <!-- Your app mounts in here! -->
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

The important line is `<script type="module" src="/src/main.ts"></script>`. That's what loads your app.

You can see we mounted our main view in `#app`, so your message will show up there.

## Step 6: Run It\!

That's it, you're ready to go. Back in your terminal, run the dev server:

```bash
npm run dev
```

Vite will spit out a local URL (usually `http://localhost:5173`). Open that up in your browser, and you should see your "Hello, Dolla\!" message.

You're officially a Dolla developer. Slay.

## What's Next?

Now that you're set up, you can start building for real. Here's where you should probably go next:

- [**Views**](./views.md): A deep dive into the main character of your app.
- [**Signals**](./signals.md) Learn all about the magic that makes your app reactive.
- [**Stores**](./stores.md): Figure out how to manage state without losing your mind.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
