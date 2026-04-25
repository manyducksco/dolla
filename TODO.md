# Known Issues

- Ordering of sibling repeat or dynamic nodes can get weird. Due to the empty comment marker system the nodes sometimes insert things at an unexpected spot.
- `<Boundary>` is so far untested.
- We are not using MarkupNode's `move` method for RepeatNode items.

## Needs

- Virtualization (lists/grids); should be able to make an infinite scrolling chat app as well as Morganizer in it with 60fps performance

## Streams (new type of signal)

- Notifies every time a value is emitted, even if values are equal.
- Getter is an object with helpers.
- Chainable transform API that runs on each item.
- Emit function can be passed as an event handler to push Event objects.

```js
const [values, emitValue] = createStream({
  // Pass an initial value for streams with non-nullable values.
  initialValue: "1",

  // Pass a context to automatically reject awaited next() calls when the context is unmounted.
  context,

  // How many values to keep in history. Defaults to '0' (only the current item).
  history: 0,
});

values.latest;
values.current(); // trackable getter
values.history(2); // trackable getter (2 = the value before last)
await values.next(); // waits for the next value

const filteredValues = values
  .filter((value) => {
    // Returns another stream that contains only filtered values from another.
  })
  .map((value) => {
    // Transform each item.
  })
  .throttle(200, { leading: true, trailing: true })
  .debounce(200)
  .delay(200);

await filteredValues.next();
```
