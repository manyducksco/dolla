# The 411 on Dolla Routing

Aight, let's talk routing. If you're building a single-page app (aka an SPA), you're gonna need a router. It's the thing that lets you have different "pages" like `/home`, `/about`, and `/users/123` without the browser doing a full page refresh every time. It makes your app feel fast and snappy, and it gives you shareable links and a working back button, which is a must. Lowkey, an app without a router is a major L.

Dolla's router is built right in, and it's designed to be super intuitive but also powerful enough to handle whatever you throw at it.

## Setting Up Your Router

First things first, you gotta create your router. You do this with the `createRouter` function. You give it a list of all the routes in your app. Then, instead of giving `createApp` your main component, you just give it the router you just made. Dolla handles the rest.

```jsx
import { createApp } from "@manyducks.co/dolla";
import { createRouter } from "@manyducks.co/dolla/router";
import { HomePage, AboutPage, NotFoundPage } from "./views.js";

const router = createRouter({
  // Use hash routing if you don't have a fancy server setup
  // hash: true,
  routes: [
    { path: "/", view: HomePage },
    { path: "/about", view: AboutPage },
    { path: "*", view: NotFoundPage },
  ],
});

const app = createApp(router);
app.mount(document.body);
```

That's the basic setup. Now, when you go to `/about`, Dolla will automatically show the `AboutPage` component. Easy peasy.

## Defining Routes

The `routes` array is the heart of your router. Each object in the array defines one route.

### Route Patterns

The `path` property tells the router what the URL should look like. It can be simple or have dynamic parts.

- **Static**: `/dashboard/settings` - a plain old path.
- **Numeric Param**: `/users/{#id}` - The `{#id}` part will only match numbers, and the `id` param will be a number.
- **Generic Param**: `/users/{name}` - The `{name}` part will match any string.
- **Wildcard**: `/files/*` - This is a catch-all. It'll match `/files/` and anything that comes after it. It can only be at the end of a path.

Dolla uses **specificity-based matching**. That means the most specific route always wins, no matter what order you define them in. So `/users/new` will always match before `/users/{name}`. No more weird ordering bugs\! No cap.

### Redirects

Instead of a `view`, you can give a route a `redirect` property. This is perfect for old URLs or for sending users from `/` to `/dashboard`.

```jsx
const router = createRouter({
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", view: DashboardPage },
  ],
});
```

### `beforeMatch`: The Gatekeeper

This is a super powerful one. `beforeMatch` is a function that runs _after_ a route matches but _before_ the view shows up. It's the perfect spot to do stuff like:

- Checking if a user is logged in.
- Fetching data for the page before it renders.
- Redirecting somewhere else based on some logic.

The `beforeMatch` function gets a context object (`ctx`) where you can call `ctx.redirect()` to send the user away, or `ctx.setState()` to pass data down to the view.

```jsx
import { sessionStore } from "./stores"; // Pretend we have a global store

const router = createRouter({
  routes: [
    { path: "/login", view: LoginPage },
    {
      path: "/dashboard",
      view: DashboardPage,
      beforeMatch: (ctx) => {
        // Gatekeep this route!
        if (!sessionStore.isLoggedIn()) {
          // If they're not logged in, yeet 'em to the login page.
          ctx.redirect("/login");
        }
      },
    },
  ],
});
```

### `data`: Stashing Info on a Route

You can also just stick a `data` object on any route. It's a chill way to attach extra info, like a page title or breadcrumbs. This data will show up in the `$match` signal from the router.

```jsx
const router = createRouter({
  routes: [
    {
      path: "/",
      view: HomePage,
      data: { title: "Welcome Home" },
    },
    {
      path: "/about",
      view: AboutPage,
      data: { title: "About Us" },
    },
  ],
});

// In some other component...
function DocumentTitle() {
  const router = useRouter();
  useEffect(() => {
    // Grab the title from the matched route's data!
    document.title = router.$match().data.title || "My App";
  });
  return null; // This component doesn't render anything
}
```

## Layout Routes: This is where it gets spicy

Okay, this is where it gets really cool. Most apps have a main layout—a navbar, a sidebar, a footer—and the actual page content changes inside that layout. Dolla makes this super easy.

To create a layout, you just make a route that has a `view` _and_ a nested `routes` array. That view becomes the layout for all the nested routes.

The best part? The child component that matches the nested route gets passed down to your layout component as the `children` prop. You can place it wherever you want\!

### Example

Let's make a main app layout with a navbar and a footer.

**1. Create the Layout View:**

Notice how it just renders `props.children` wherever the page content should go.

```jsx
// views/MainLayout.jsx
function MainLayout(props) {
  return (
    <div class="app-container">
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a>
      </nav>

      <main>
        {/* The child route will be rendered right here! */}
        {props.children}
      </main>

      <footer>
        <p>&copy; 2024 My Awesome App</p>
      </footer>
    </div>
  );
}
```

**2. Set up the Router to use the Layout:**

```jsx
// router.js
import { createRouter } from "@manyducks.co/dolla/router";
import { MainLayout } from "./views/MainLayout.jsx";
import { HomePage, AboutPage } from "./views.js";

const router = createRouter({
  routes: [
    {
      // This is our layout route
      path: "/",
      view: MainLayout,
      // These routes will be rendered inside MainLayout
      routes: [
        { path: "/", view: HomePage },
        { path: "/about", view: AboutPage },
      ],
    },
  ],
});
```

Now, when you go to `/` or `/about`, you'll see the `MainLayout` with either `HomePage` or `AboutPage` rendered inside that `<main>` tag. It's clean, it's simple, and it just works. It's giving... effortless.

## Hopping Around Your App

Sometimes you need to change the page from your code, like after a form submission. For that, you use the `useRouter` hook.

### `useRouter()`

This hook gives you the router instance, which has a bunch of useful methods and signals.

- `router.go(path, options?)`: The main way to navigate. You can also pass an `options` object.
  - `replace: true`: Replaces the current page in history instead of adding a new one. The back button will skip it.
  - `preserveQuery: true`: Keeps the current query params and merges them with any new ones.
- `router.back()`: Goes back one step in the browser history.
- `router.forward()`: Goes forward one step.
- `router.updateQuery(params)`: Just changes the query params in the URL without a full navigation. Super useful for filters and sorting.

<!-- end list -->

```jsx
import { useRouter } from "@manyducks.co/dolla/router";

function SomeComponent() {
  const router = useRouter();

  const goToUser = () => {
    // This will go to /users/42 but won't add a new history entry
    router.go("/users/42", { replace: true });
  };

  const setSort = () => {
    // This will just change the URL to ?sort=name without reloading
    router.updateQuery({ sort: "name" });
  };

  return (
    <>
      <button onClick={goToUser}>Go to User 42</button>
      <button onClick={setSort}>Sort by Name</button>
    </>
  );
}
```

## Spying on the Route

Your components often need to know what the current URL is, especially to get params like a user's ID. The `useRouter` hook gives you reactive signals for this too\!

- `$match`: A signal with the whole match object, including path, params, query, and any `data` you added to the route.
- `$path`: A signal with the current path (e.g., `/users/123`).
- `$params`: A signal with an object of the dynamic parts of the URL (e.g., `{ id: 123 }`).
- `$query`: A signal with an object of the query params (e.g., `?sort=asc` becomes `{ sort: 'asc' }`).
- `$pattern`: A signal with the full route pattern that was matched (e.g., `/users/{#id}`). If you're in a nested route, this will be the full joined path, like `/users/{#id}/posts`.

<!-- end list -->

```jsx
import { useRouter } from "@manyducks.co/dolla/router";
import { useEffect, useSignal } from "@manyducks.co/dolla";

function UserProfilePage() {
  const router = useRouter();
  const { $params } = router;
  const [$user, setUser] = useSignal(null);

  // This effect will automatically re-run if the user ID in the URL changes!
  useEffect(() => {
    const userId = $params().id;
    // You can't pass an async function directly to useEffect,
    // so we define one inside and call it.
    const fetchUser = async () => {
      const data = await fetch(`/api/users/${userId}`).then((res) => res.json());
      setUser(data);
    };

    if (userId) {
      fetchUser();
    }
  });

  return (
    <div>
      <h1>User Profile</h1>
      <Show when={$user}>
        <p>Name: {() => $user().name}</p>
      </Show>
    </div>
  );
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
