# View State

```js
function SomeView(props, ctx) {
  const count = state(0);

  // derive some state
  const doubled = state(() => count.get() * 2);

  count.set(15);



}
```
