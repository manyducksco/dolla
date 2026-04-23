# Reactivity

- atoms, compose, effects
- tracking (compose, effect and DOM contexts)

```js
const [count, setCount] = createAtom(0);

count(); // get the value
setCount(5); // set the value
setCount(5); // set the value
(current) => current + 5; // set the value through a transform function

const doubled = compose(() => count() * 2);

doubled(); // get the value

setCount(25);
doubled(); // returns 50

// Effect functions are invoked immediately and again each time their tracked states are updated.
const stopEffect = createEffect(() => {
  console.log("count is now", count());

  peek(count); // access the value without tracking

  return () => {
    // May return a cleanup function that is called between invocations and when the effect is stopped.
  };
});

stopEffect(); // stop listening for changes
```
