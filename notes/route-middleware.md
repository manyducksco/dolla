# Router Middleware

Allow handling route guards, preloading, etc with per-route middleware. When a route is matched, all middleware from higher layers are run again.

```js
Dolla.router.setup({
  middleware: [/* does it make sense to have global middleware? */]
  routes: [
    { path: "/login", middleware: [auth] },
    { path: "/", middleware: [auth], routes: [{ path: "/example", view: ExampleView }] }
  ]
});

async function auth(ctx) {
  // This check can be implemented however it needs to be for the app.
  const authed = await isAuthorized();

  if (ctx.path === "/login") {
    if (authed) {
      ctx.redirect("/");
    }
  } else {
    if (!authed) {
      ctx.redirect("/login");
    }
  }
  // If no redirect has happened and nothing has been returned then we're clear to proceed.
}

// A middleware can also return Markup to stay on the URL but show something different.
async function randomVisitor(ctx) {
  if (Math.random() > 0.99) {
    return <LuckyVisitorView />
  }
}

// Or preload async data and set a context variable before navigating.
async function preload(ctx) {
  const data = await fetchData();
  ctx.set("data", data);
}
```
