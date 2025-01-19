# Idea: Context Variables

In designing how Dolla's version of 'context' works, I've been going through a few different ideas. The simplest seems to be the ability to store _context variables_ that, once set, are accessible on the same context or any child context.

```js
function SomeView(props, ctx) {
  ctx.set("key", 5);

  // ... and in a child view do
  ctx.get("key");
  // which returns null if the value isn't present.
  // It's like localStorage for the view tree.
}
```

They can be typed, but always with a possibility to return null.

```js
const value = ctx.get<number>("key");
// value is number | null to force the programmer to check it.
```
