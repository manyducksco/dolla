# Router

```js
const router = createRouter({
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
});

mount(router, document.body);
```
