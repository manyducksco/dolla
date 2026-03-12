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

function HomePage() {
  // Access the router from any child component.
  const router = useRouter(this);

  router.push("/users/5/edit");

  console.log(router.path());

  /* return ... */
}

createRoot(document.body).mount(router);
```
