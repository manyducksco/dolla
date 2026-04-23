# Router

```js
import { createRouterPlugin, getRouter } from "@manyducks.co/dolla/router";

function HomePage() {
  // Access the router from any child view.
  const router = getRouter(this);

  router.push("/users/5/edit");

  console.log(router.path());

  /* return ... */
}

createRoot(document.body)
  .plugin(
    createRouterPlugin({
      routes: [
        { path: "/", view: HomePage },
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
    }),
  )
  .mount(router);
```

## Route Patterns

- **Static**: `/dashboard/settings`
- **Number Param** (only matches numbers): `/users/{#id}`
- **Optional Param** : `/artists/{#artistId?}`
- **Anything Param**: `/users/{name}`
- **Wildcard**: `/files/*`
