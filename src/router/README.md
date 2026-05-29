# Router

A client-side router with nested routes, lazy loading, auth guards, and async data fetching.

```js
import { createRoot, html } from "@manyducks.co/dolla";
import { createRouter, Outlet, getRouter } from "@manyducks.co/dolla/router";

function HomePage() {
  const router = getRouter(this);
  return html`<p>Current path: ${router.path}</p>`;
}

createRoot("#app")
  .plugin(createRouter({
    routes: [
      { path: "/", view: HomePage },
    ],
  }))
  .mount(HomePage);
```

## Routes

Each route has a `path` pattern and a `view` component. Nested routes use an `<${Outlet} />` component to render child views.

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
function UsersLayout() {
  return html`
    <nav>...</nav>
    <main><${Outlet} /></main>
  `;
}
```

### Route Patterns

| Pattern | Description | Example |
|---|---|---|
| `/users` | Static — matches exactly `/users` |
| `/users/{#id}` | Numeric param — matches only numbers |
| `/users/{name}` | String param — matches any non-slash segment |
| `/artists/{#artistId?}` | Optional param — matches even if the segment is absent |
| `/files/*` | Wildcard — matches everything after `/files/` |

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

## Preloading data

Routes can define a `preload` function that fetches data before the view renders. The returned data is passed to the view as `props.data`:

```js
{
  path: "/user/{#id}",
  view: UserDetail,
  preload: (match) => fetch(`/api/users/${match.params.id}`).then(r => r.json()),
}
```

```jsx
function UserDetail({ data }) {
  return html`<p>Name: ${data.name}</p>`;
}
```

## Error handling

Provide an `errorView` to catch errors from `preload` or lazy loading:

```js
{
  path: "/risky",
  view: RiskyPage,
  errorView: ({ error }) => html`<p>Something went wrong: ${error.message}</p>`,
}
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
  redirect: (match) => fetch(`/api/users/${match.params.id}`).then(r => r.json()).then(user => `/profile/${user.handle}`),
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
|---|---|---|
| `path` | `Getter<string>` | Current URL path |
| `pattern` | `Getter<string \| undefined>` | Matched route pattern |
| `params` | `Getter<Record<string, string>>` | Extracted path parameters |
| `query` | `Getter<Record<string, string>>` | Current query parameters |
| `meta` | `Getter<Record<string, any>>` | Merged meta from matched layers |
| `progress` | `Getter<number>` | Navigation progress (0–1, 0 when idle) |

| Method | Description |
|---|---|
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

## Outlet

`<${Outlet} />` renders the matched child route. Use it in layout views to nest routes.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `routes` | `Route[]` | — | Route definitions |
| `hash` | `boolean` | `false` | Use hash-based routing (`/#!/path`) |
| `preserveQuery` | `boolean \| string[]` | `false` | Preserve query params across navigations |
