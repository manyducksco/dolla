# Reactivity

States, memos and effects.

```js
const count = state(0);

count(); // get the value
count(5); // set the value
count((current) => current + 5); // set the value through a transform function

const doubled = memo(() => count() * 2);

doubled(); // get the value

count(25);
doubled(); // returns 50

// Effect functions are invoked immediately and again each time their tracked states are updated.
const stop = effect(() => {
  console.log("count is now", count());

  peek(count); // access the value without tracking

  return () => {
    // May return a cleanup function that is called between invocations and when the effect is stopped.
  };
});

stop(); // stop listening for changes
```
