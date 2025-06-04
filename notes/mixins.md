# Mixins

Sometimes you want to attach logic to a DOM node without writing a whole view around it.

```js
function myMixin(options: any): Mixin {
  return function(element: Element, ctx: MixinContext) {
    ctx.onMount(() => {

    })

    ctx.onUnmount(() => {

    })
  }


  // Returns nothing. Use context methods to attach event listeners / behavior / whatever.
}

<h1 mixins={[myMixin({ /* options */ }), /* ... */]}>Whatever</h1>
```
