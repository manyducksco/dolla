# Dolla Stores: The State Management Glow Up

Aight, let's get into one of the most clutch features in Dolla: **Stores**. If you've ever built an app that's more than just a single page, you've probably run into the nightmare of trying to share state between components that are far apart. This is called "prop drilling," and it's a total vibe killer.

Prop drilling is when you have to pass a prop down through like, five different components that don't even need it, just to get it to the one component at the bottom that _actually_ needs it. It's messy, it's annoying, and it makes your code a nightmare to change later.

**Stores are the answer.** They're Dolla's built-in way to create shared state that any component can tap into, no matter where it is in your app. No more prop drilling. Ever.

## So, what even IS a Store?

A Store is just a special type of component that doesn't render any UI. Its only job is to hold onto some state (signals) and the functions that can change that state. It's like a little brain for a specific part of your app.

By creating a store, you're making a clean, reusable API for your state that any component can use.

## How to Make a Store

Making a store is super easy. It's just a function that returns an object. Inside, you use `useSignal`, `useMemo`, and other hooks to create your state, and then you return the signals and functions you want other components to be able to use.

### Example: A `ThemeStore`

Let's make a simple store that keeps track of whether the app is in light or dark mode.

```jsx
import { useSignal, useMemo } from "@manyducks.co/dolla";

// This is our store! It's just a function.
function ThemeStore(options) {
  // 1. Create the state with useSignal. We can use the options to set a default.
  const [$theme, setTheme] = useSignal(options.defaultTheme || "light");

  // 2. We can even have derived state with useMemo.
  const $isDarkMode = useMemo(() => $theme() === "dark");

  // 3. Create functions that are the ONLY way to change the state.
  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"));
  };

  // 4. Return the public API for our store.
  return { $theme, $isDarkMode, toggleTheme };
}
```

By only returning `toggleTheme`, we're making sure no component can just set the theme to some random value like `"bunnies"`. They _have_ to use our function. It keeps things clean and predictable.

## How to Use a Store

Using a store is a two-step process: you **provide** it, and then you **use** it.

### Step 1: `useStoreProvider`

First, you need to make your store available to a part of your app. You usually do this in a high-level component, like your main `App` view. This is called "providing" the store.

```jsx
import { useStoreProvider } from "@manyducks.co/dolla";
import { ThemeStore } from "./stores/ThemeStore.js";
import { PageContent } from "./PageContent.jsx";

function App() {
  // We're providing the ThemeStore to our entire app.
  // We can also pass in options here.
  useStoreProvider(ThemeStore, { defaultTheme: "dark" });

  return (
    <div>
      <h1>My Awesome App</h1>
      <PageContent />
    </div>
  );
}
```

Now, the `App` component and every single component inside of it (no matter how deep) can access this one instance of `ThemeStore`.

### Step 2: `useStore`

Now that the store is provided, any child component can just ask for it with the `useStore` hook.

```jsx
import { useStore } from "@manyducks.co/dolla";
import { ThemeStore } from "./stores/ThemeStore.js";

function ThemeToggleButton() {
  // Just ask for the ThemeStore! Dolla will find it.
  const theme = useStore(ThemeStore);

  return <button onClick={theme.toggleTheme}>Switch to {() => (theme.$isDarkMode() ? "Light" : "Dark")} Mode</button>;
}

function Header() {
  const theme = useStore(ThemeStore);

  // This class will automatically update when the theme changes!
  return (
    <header class={{ "dark-mode": theme.$isDarkMode }}>
      <h2>Current Theme: {theme.$theme}</h2>
      <ThemeToggleButton />
    </header>
  );
}
```

And that's it\! The `ThemeToggleButton` and `Header` can be anywhere inside `App`, and they'll both get the exact same store instance. When you click the button, `toggleTheme` is called, the `$theme` signal updates, and both the button text and the header's class will automatically change.

No prop drilling. Just clean, reactive state. It's a whole vibe.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
