# Atomic API

```js
function SomeView(props, ctx) {
  // Atoms are the basic building block of state.
  const count = new Atom(5);

  count.value; // returns the value
  count.value = 12; // replaces the value
  count.update((value) => value + 1); // updates the value. You can use Immer here for complex objects.

  // or you could just implement an update function yourself with Immer. Probably gonna cut it.
  function update(atom, callback) {
    atom.value = produce(atom.value, callback);
  }
  update(count, (value) => value + 1);

  // Listen for changes. Callback will be run the next time the value changes and each time again afterwards.
  const unsubscribe = count.subscribe((value) => {
    console.log(value);
  });

  // Composed is a state that depends on one or more other states.
  // The callback takes a getter function that will track that state as a dependency and return its current value.
  // We recompute if any tracked dependency receives a new value.
  const doubled = new Composed((get) => get(count) * 2);

  // Effects follow the same pattern as a Composed callback.
  ctx.effect(() => {
    console.log(doubled.value);
  });

  const print = new Atom(false);

  // Dependency lists are rebuilt every time the callback is run.
  // Below, `value` will not be tracked as a dependency until `print` has changed to true.
  ctx.effect(() => {
    if (get(print)) {
      console.log(get(value));
    }
  });

  // get() is also the ONLY way to track dependencies.
  // You're free to use the state's own getter if you want the value without actually tracking it.
  ctx.effect((get) => {
    if (get(value) > 5) {
      console.log(doubled.get()); // will not be tracked
    }
  });

  // ALSO: Need to track sets and updates so we can throw an error if a set was committed in the same scope that value is tracked. Otherwise this will cause an infinite loop.
}
```

Refined API:

```js

const $count = atom(5);
$count.value++;
$count.value; // 6

const $doubled = compose(() => get($count) * 2);
const $quadrupled = compose(() => get($doubled) * 2);

ctx.effect(() => {
  if (get($count) > 25) {
    console.log($doubled.value);
    get($quadrupled);
  }
});
```

vs old API:

```js
// ----- Basic State ----- //

// Old
const [$count, setCount] = createState(5);
setCount((count) => count + 1);
$count.get(); // 6

// New
const count = atom(5);
count.value++;
count.value; // 6

// ----- Derived State ----- //

// Old
const $doubled = derive([$count], (count) => count * 2);
const $quadrupled = derive([$doubled], (doubled) => doubled * 2);

// New
const doubled = compose((get) => get(count) * 2);
const quadrupled = compose((get) => get(doubled) * 2);

// ----- Side Effects ----- //

// Old
ctx.watch([$count, $quadrupled], (count, quadrupled) => {
  if (count > 25) {
    console.log($doubled.get()); // not tracked

    console.log(quadrupled);
    // changes to $quadrupled will trigger this callback to re-run, even if count is still <= 25
  }
});

// New
ctx.effect((get) => {
  // count is tracked by reading it with 'get'
  if (get(count) > 25) {
    console.log(doubled.value); // not tracked

    get(quadrupled); // only tracked while count > 25 (this 'get' doesn't run otherwise)
    // changes to 'quadrupled' will NOT trigger this callback to re-run unless 'count' is already >= 25
  }
});
```

Atoms and composed values implement the `Reactive<T>` interface for TypeScript purposes. There is also `Atom<T>` and `Composed<T>` if you want to be specific.

The API above is a remix of Preact signals, Jotai and the TC39 Signals proposal. I strongly dislike automatic dependency tracking. I think the developer should explicitly describe what they want instead of having the language assume what they want and making them opt out with `untrack` and such. Madness.

It's also unintuitive what's a tracked scope and what isn't. There's nothing to tell you that at a glance. It's left up to the framework conventions. With this API you know; if you're in a function scope and you have a getter, you're in a tracking-capable scope. Doing that tracking is then left up to you. You can explicitly see that things are being tracked by reading the code. There is no background knowledge needed and no side effects required.

Further API:

```js
// If count is reactive we get its current value. Otherwise we get it as is.
const value = unwrap(count);

// If count is reactive we get it as is (typed as Reactive<T>). Otherwise we get it wrapped as a Reactive<T>.
const value = reactive(count);
```

```js
const me = compose((get) => {
  const id = get(userId);
  return get(users)_?.find((u) => u.id === id);
});

const $me = derive([$userId, $users], (id, users) => users?.find((u) => u.id === id));
```
