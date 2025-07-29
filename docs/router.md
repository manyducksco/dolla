# Router

Dolla makes heavy use of client-side routing. You can define as many routes as you have views, and the URL
will determine which one the app shows at any given time. By building an app around routes, lots of things one expects
from a web app will just work; back and forward buttons, sharable URLs, bookmarks, etc.

Routes are matched by highest specificity regardless of the order they were registered.
This avoids some confusing situations that come up with order-based routers like that of `express`.
On the other hand, order-based routers can support regular expressions as patterns which Dolla's router cannot.

## Route Patterns

Routes are defined with strings called patterns. A pattern defines the shape the URL path must match, with special
placeholders for variables that appear within the route. Values matched by those placeholders are parsed out and exposed
to your code (`router` store, `$params` readable). Below are some examples of patterns and how they work.

- Static: `/this/is/static` has no params and will match only when the route is exactly `/this/is/static`.
- Numeric params: `/users/{#id}/edit` has the named param `{#id}` which matches numbers only, such as `123` or `52`. The
  resulting value will be parsed as a number.
- Generic params: `/users/{name}` has the named param `{name}` which matches anything in that position in the path. The
  resulting value will be a string.
- Wildcard: `/users/*` will match anything beginning with `/users` and store everything after that in params
  as `wildcard`. `*` is valid only at the end of a route.

Now, here are some route examples in the context of an app:

```js
import { createApp } from "@manyducks.co/dolla";
import { createRouter } from "@manyducks.co/dolla/router";
import { ThingIndex, ThingDetails, ThingEdit, ThingDelete } from "./views.js";

const router = createRouter({
  routes: [
    {
      // A `null` component with subroutes acts as a namespace for those subroutes.
      // Passing a view instead of `null` results in subroutes being rendered inside that view wherever `ctx.outlet()` is called.
      path: "/things",
      view: null,
      routes: [
        { path: "/", view: ThingIndex }, // matches `/things`
        { path: "/{#id}", view: ThingDetails }, // matches `/things/{#id}`
        { path: "/{#id}/edit", view: ThingEdit }, // matches `/things/{#id}/edit`
        { path: "/{#id}/delete", view: ThingDelete }, // matches `/things/{#id}/delete`
      ],
    },
    // All routes that don't match anything else will redirect to `/things`
    { path: "*", redirect: "/things" },
  ],
});

// Pass the router in place of a root view.
const app = createApp(router);

app.mount(document.body);
```

When the URL matches a pattern the corresponding view is displayed. If we visit `/people/john`,
we will see the `PersonDetails` view and the params will be `{ name: "john" }`. Params can be
accessed from anywhere in the app through `Dolla.router`.

```js
const router = // ... //

// Info about the current route is exported as a set of signals.
const { $path, $pattern, $params, $query } = router;

router.back(); // Step back in the history to the previous route, if any.
router.back(2); // Hit the back button twice.

router.forward(); // Step forward in the history to the next route, if any.
router.forward(4); // Hit the forward button 4 times.

router.go("/things/152"); // Navigate to another path within the same app.
router.go("https://www.example.com/another/site"); // Navigate to another domain entirely.
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
