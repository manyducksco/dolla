# Router

A client-side router with nested routes, lazy loading, auth guards, and async data fetching.

```jsx
import { createRoot } from "@manyducks.co/dolla";
import { createRouter, Outlet, getRouter } from "@manyducks.co/dolla/router";

function HomePage(props, context) {
  const router = getRouter(context);
  return <p>Current path: {router.path}</p>;
}

function App() {
  return (
    <>
      <header>My app</header>
      <main>
        <Outlet />
      </main>
    </>
  );
}

await createRoot("#app")
  .plugin(
    createRouter({
      routes: [{ path: "/", view: HomePage }],
    }),
  )
  .mount(App);
```

`App` is the root view and uses `<Outlet />` to render the matched route. Nested layout views receive their child layer as `props.children`.

## Routes

Each route has a `path` pattern and a `view` component. The root view uses `<Outlet />` to render the matched route; nested layout views receive their child route as `props.children`.

```js
createRouter({
  routes: [
    {
      path: "/users",
      view: UsersLayout,
      routes: [
        { path: "/", view: UsersList },
        { path: "/{#id}", view: UserDetail },
        { path: "/{#id}/edit", view: UserEdit },
      ],
    },
  ],
});
```

```jsx
function UsersLayout(props) {
  return (
    <>
      <nav>...</nav>
      <main>{props.children}</main>
    </>
  );
}
```

### Route Patterns

| Pattern | Description | Example |
| --- | --- | --- |
| `/users` | Static — matches exactly `/users` | `/users` |
| `/users/{#id}` | Numeric param — matches only numbers | `/users/123` |
| `/users/{name}` | String param — matches any non-slash segment | `/users/alice` |
| `/artists/{#artistId?}` | Optional param — matches even if the segment is absent | `/artists` or `/artists/42` |
| `/files/*` | Wildcard — matches everything after `/files/` | `/files/a/b` |

### Reading route state

`path`, `pattern`, `params`, `query`, and `meta` are getters. Interpolate them directly for a reactive value, or wrap property access in a getter:

```jsx
function UserPage(props, context) {
  const router = getRouter(context);

  return (
    <>
      <p>Path: {router.path}</p>
      <p>User id: {() => router.params().id}</p>
      <p>Search: {() => router.query().q}</p>
    </>
  );
}
```

`isActive(path, exact?)` returns a getter, which works directly in a reactive class object:

```jsx
<a class={{ active: router.isActive("/users") }}>Users</a>;
```

### Meta data

Attach arbitrary data to a route:

```js
{
  path: "/admin",
  view: AdminPage,
  meta: { requiresAuth: true },
}
```

Meta from all matched layers is merged and accessible via `router.meta`.

### Not found

Add a final wildcard route to handle unmatched paths:

```js
{
  path: "*",
  view: NotFoundPage,
}
```

`*` matches any remaining path segments. Without a matching route, the router leaves the current view in place and resets `progress` to `0`.

## Lazy loading

Use `lazy()` to code-split route views:

```js
import { lazy } from "@manyducks.co/dolla/router";

createRouter({
  routes: [
    { path: "/dashboard", view: lazy(() => import("./views/dashboard.js")) },
  ],
});
```

The loaded module is cached on the route definition, so navigating back to the route does not fetch it again. Load failures are handled by the route's `errorView`.

## Loading UI

`router.progress` is a getter from `0` to `1` while navigation is in flight, and `0` when idle:

```jsx
import { showIf } from "@manyducks.co/dolla";

function App(props, context) {
  const router = getRouter(context);

  return (
    <>
      {showIf(() => router.progress() > 0, <div class="loading-bar" />)}
      <main>
        <Outlet />
      </main>
    </>
  );
}
```

## Preloading data

Routes can define a `preload` function that fetches data before the view renders. The returned data is passed to the view as `props.data`:

```js
{
  path: "/user/{#id}",
  view: UserDetail,
  preload: (match) => fetch(`/api/users/${match.params.id}`).then((response) => response.json()),
}
```

```jsx
function UserDetail({ data }) {
  return <p>Name: {data.name}</p>;
}
```

## Error handling

Provide an `errorView` to catch errors from `preload` or lazy loading:

```jsx
const route = {
  path: "/risky",
  view: RiskyPage,
  errorView: ({ error }) => <p>Something went wrong: {error.message}</p>,
};
```

## Redirects

Redirect a matched route to another path:

```js
{
  path: "/old-page",
  redirect: "/new-page",
}
```

Dynamic redirects using a function:

```js
{
  path: "/user/{#id}",
  redirect: (match) =>
    fetch(`/api/users/${match.params.id}`)
      .then((response) => response.json())
      .then((user) => `/profile/${user.handle}`),
}
```

Programmatic redirects from `preload`:

```js
{
  path: "/secret",
  preload: () => {
    if (!isLoggedIn()) throw new RedirectError("/login");
  },
}
```

## Router API

Access the router with `getRouter(context)`:

| Property | Type | Description |
| --- | --- | --- |
| `path` | `Getter<string>` | Current URL path |
| `pattern` | `Getter<string \| undefined>` | Matched route pattern |
| `params` | `Getter<Record<string, string>>` | Extracted path parameters |
| `query` | `Getter<Record<string, string>>` | Current query parameters |
| `meta` | `Getter<Record<string, any>>` | Merged meta from matched layers |
| `progress` | `Getter<number>` | Navigation progress (0–1, 0 when idle) |

| Method | Description |
| --- | --- |
| `push(path)` | Navigate to a new path |
| `replace(path)` | Replace current history entry and navigate |
| `back(steps?)` | Go back in history |
| `forward(steps?)` | Go forward in history |
| `setQuery(params)` | Update query params without changing route. Pass `null` to delete a key |
| `isActive(path, exact?)` | Returns a `Getter<boolean>` — true when the current route matches `path` |
| `block(guard)` | Register a navigation guard. Returns an unsubscribe function |

## Navigation guards

Prevent navigation with a guard:

```js
const unblock = router.block(() => {
  return confirm("Are you sure you want to leave?");
});
```

Guards can be async. Navigation is blocked while any guard returns `true`.

### Protected routes

For authentication, redirect from `preload` instead of blocking silently:

```js
import { RedirectError } from "@manyducks.co/dolla/router";

{
  path: "/admin",
  view: AdminPage,
  preload: () => {
    if (!isLoggedIn()) throw new RedirectError("/login");
  },
}
```

`block` is for confirmation-style guards:

```js
const unblock = router.block(async () => {
  return await hasUnsavedChanges();
});
```

When guards are registered, the router also warns on tab close via `beforeunload`. Call `unblock()` to remove the guard.

## Navigation

```js
router.push("/users/1");
router.replace("/users/1");
router.back();
router.forward(2);
router.setQuery({ q: "alice", page: null }); // null deletes a key
```

`push` and `replace` return immediately; navigation work continues asynchronously. Use `router.progress` for loading UI.

## Outlet

`<Outlet />` renders the matched route in the root layout. Nested layout views receive their child route as `props.children`:

```jsx
function AdminLayout(props) {
  return (
    <>
      <nav>...</nav>
      <section>{props.children}</section>
    </>
  );
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `routes` | `Route[]` | — | Route definitions |
| `hash` | `boolean` | `false` | Use hash-based routing (`/#!/path`) |
| `preserveQuery` | `boolean \| string[]` | `false` | Preserve query params across navigations |
