# Dolla Hooks: The Cheat Sheet

Hooks are functions that begin with a `$` symbol, which signifies that they can only be called at the top level of a component function. This rule will be familiar if you've worked with React.

Hooks use a clever trick to access the internal state of the component they are called in.

## Lifecycle Hooks

These hooks let you run code when your component is born, when it dies, and all the moments in between.

### `$setup(callback)` and `$teardown(callback)`

Runs your code right after the component shows up on the page. If your function returns _another_ function, Dolla will automatically run that right after the component gets yeeted off the page. Perfect for cleanup\!

**Signature:**

```ts
type CleanupCallback = () => void;

interface SetupCallback {
  (): void;
  (): CleanupCallback;
  (signal: AbortSignal): Promise<void>;
  (signal: AbortSignal): Promise<CleanupCallback>;
}

function $setup(callback: SetupCallback): void;

interface TeardownCallback {
  (): void;
}

function $teardown(callback: TeardownCallback): void;
```

**Example:**

```tsx
import { $setup, $teardown, state } from "@manyducks.co/dolla";

function IntervalTimer() {
  const seconds = state(0);

  const debug = $debug();

  $setup(() => {
    // Start a timer when the component shows up
    const intervalId = setInterval(() => {
      seconds.update((s) => s + 1);
    }, 1000);

    // Returning a function from $setup will run it on teardown.
    // This is helpful to keep references like `intervalId` inside the $setup scope.
    return () => {
      console.log("cleaning up counter interval");
      clearInterval(intervalId);
    };
  });

  // An async setup callback takes an AbortSignal that aborts when the view is unmounted.
  // Use it to cancel in-flight requests and other pending logic.
  $setup(async (signal) => {
    fetch("/api/data", { signal })
      .then((res) => res.json())
      .then((data) => {
        seconds.set(data.count);
      })
      .catch((err) => {
        if (err instanceof AbortError) {
          debug.info("view unmounted; fetch aborted");
        }
      });
  });

  $teardown(() => {
    // Tell your analytics that the user bounced
    fireAnalyticsEvent(`user_left_${eventName}_view`);
  });

  return <p>Seconds on page: {seconds}</p>;
}
```

### `$on(event, callback)`

Components have five lifecycle events. The `$setup` and `$teardown` are shorthand for `$on("didMount", ...)` and `$on("didUnmount", ...)` respectively. Those are the most commonly needed transitions. For advanced use cases, the `$on` hook gives you access to everything.

- `willMount` (called just before DOM nodes are added to the page)
- `didMount` (called just after DOM nodes are added to the page; equivalent to `$setup` hook)
- `willUnmount` (called just before DOM nodes are removed from the page)
- `didUnmount` (called just after DOM nodes are removed from the page; equivalent to `$teardown` hook)
- `dispose` (called after unmount when component instance will not be mounted again)

**Signature:**

```ts
type LifecycleEvent = "willMount" | "didMount" | "willUnmount" | "didUnmount" | "dispose";

function $on(event: LifecycleEvent, callback: () => void): void;
```

**Example:**

```ts
import { $on } from "@manyducks.co/dolla";

function Lifecycle() {
  $on("willMount", () => {
    // Just about to mount. Accessing DOM nodes will not work yet.
  });

  $on("didMount", () => {
    // Just mounted. Accessing DOM nodes is possible now.
  });

  $on("willUnmount", () => {
    // Still in the DOM, but going away just after this runs.
  });

  $on("didUnmount", () => {
    // No longer in the DOM.
  });

  $on("dispose", () => {
    // Unmounted and never going to be mounted again.
  });

  return <div>...</div>
}
```

## Effect Hooks

These are for doing "side effects" - stuff that isn't just rendering, like fetching data or messing with the DOM directly.

### `$watch(callback, deps?)`

The go-to hook for side effects. Your code runs after the component shows up, and then again whenever the signals it uses change. It's automatic, but you can give it a `deps` array if you wanna be extra and control it yourself.

**Signature:**

```ts
function $watch(fn: () => void, deps?: Signal<any>[]): void;
```

**Example:**

```tsx
import { $watch, state } from "@manyducks.co/dolla";
import { http } from "@manyducks.co/dolla/http";

function UserData({ userId }) {
  const user = state();

  // This function will re-run whenever the userId prop changes.
  $watch(() => {
    const id = userId.track(); // track a signal
    http.get(`/api/users/${id}`).then((res) => {
      user.set(res.body); // Update user
    });
  });

  return (
    <Show when={user}>
      <p>User: {computed(() => user.track().name)}</p>
    </Show>
  );
}
```

## Context Hooks

These are the hooks you use to mess with the context system. Think of it like a way to pass stuff down to your components without having to prop drill, which is a total vibe killer.

### `$name(name)`

> TODO: Fill in

Sets the context name for logging purposes.

### `$debug(name?)`

This just grabs the `Context` object for whatever component you're in. The context has useful stuff like loggers and is how stores get passed around.

**Signature:**

```ts
function useContext(name?: MaybeSignal<string>): Context;
```

**Parameters:**

- `name` (optional): A string or signal you can pass in to give your component a custom name for logging. Makes debugging less of a headache.

**Example:**

```tsx
import { useContext } from "@manyducks.co/dolla";

function UserProfile() {
  // Grab the context and give it a cooler name
  const context = useContext("UserProfilePage");

  useMount(() => {
    // The log will now say "[UserProfilePage]". Noice.
    context.log("Component just dropped.");
  });

  return <div>...</div>;
}
```

### `$provide(Store, options?)` and `$use(Store)`

The `$provide` hook creates a new instance of a store and makes it available to the component it's called in. The `$use` hook accesses that instance from a child component.

**Signature:**

```ts
function $provide<T, O>(store: Store<O, T>, storeOptions?: O): T;

function $use<T>(store: Store<any, T>): T;
```

**Example:**

```tsx
import { $provide, $use } from "@manyducks.co/dolla";
import { ThemeStore } from "./stores/ThemeStore.js";
import { AppContent } from "./AppContent.js";

function App() {
  // Provide the ThemeStore to the whole app.
  // Any child can now get it with $use(ThemeStore).
  $provide(ThemeStore, { defaultTheme: "dark" });

  return <AppContent />;
}
```

**Example:**

```tsx
import { $provide, $use } from "@manyducks.co/dolla";
import { AuthStore } from "./stores/auth.js";

function App() {
  // Provide the AuthStore to the whole app.
  // Any child can now get it with $use(AuthStore).
  // We can also access it here since the instance is returned.
  const auth = $provide(AuthStore);

  return (
    <main>
      <header>
        <Navbar />
      </header>
      <div>...</div>
    </main>
  );
}

function Navbar() {
  const { isLoggedIn, user } = $use(AuthStore);

  return (
    <nav>
      <Show when={isLoggedIn}>
        <p>Yo, {() => user().name}!</p>
      </Show>
    </nav>
  );
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
