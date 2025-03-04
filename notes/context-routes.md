# Context routing

I had an idea to integrate routing back into views instead of having a separate router. I originally had it work this way but I wasn't good enough to pull it off then.

Here's how it might look:

```jsx
function Example(props, ctx) {
  return <div>
    <header>
      <h1>Some kind of layout.</h1>
    </header>
    <main>
      {this.router(function () {
        this.route("something/*", SomethingView);
        this.redirect("*", "./something/*");
      })}

      {ctx.router([
        // Route path is relative to parent routes.
        // Nested route definitions are a thing of the past.
        // View could define its own routes.
        { path: "something/*", view: SomethingView }
      ])}
    </main>
  <div>
}

html`
  <${Router}>
    <${Route} path="something/*">
      This child content isn't materialized until the route matches.
      <${SomethingView} />
    <//>
  <//>
`
```

This removes the need to import and define the whole app at the top level. You can also add routes as you need them when prototyping.

Route matching would be done by forwarding the wildcard portion of a match to child routers. Routers would be stored on the element context.

Where would route info be stored then? It would have to be on the context as well.

```js
// Merged data from all parent segments.
ctx.route.params;
ctx.route.query;
ctx.route.path;
ctx.route.pattern;

ctx.go("/some/path");
ctx.back();
ctx.forward();
```

## Thoughts

- Would eliminate the need for `ctx.outlet()`. Can pass children directly via `children` prop now.
- Would eliminate the need for `ViewElement` and `setChildView` method because a top level router no longer needs to call it.
- Couldn't do the current routing strategy of combining all routes into one flat list at the top level.
