# States

States are observable containers that hold state that can change while the app is running. You can slot them into your views and those elements will be updated any time the state changes thereafter.

```jsx
import { createState, toState, valueOf, derive, createWatcher } from "@manyducks.co/dolla";

const [$count, setCount] = createState(72);

// Get value
$count.get(): // 72

// Replace the stored value with something else
setCount(300);
$count.get(); // 300

// You can also pass a function that takes the current value and returns a new one
setCount((current) => current + 1);
$count.get(); // 301

// Derive a new state from one or more other states. Whenever $count changes, $doubled will follow.
const $doubled = derive([$count], (count) => count * 2);
const $sum = derive([$count, $doubled], (count, doubled) => count + doubled);

// Returns the value of a state. If the value is not a state it is returned as is.
const count = valueOf($count);
const bool = valueOf(true);

// Creates a state from a value. If the value is already a state it is returned as is.
const $bool = toState(true);
const $anotherCount = toState($count);

const watcher = createWatcher();

// Watch for changes to the value
const stop = watcher.watch([$count], (value) => [
// This function is called immediately with the current value, then again each time the value changes.
]);
stop(); // Stop watching for changes

```

States also come in a settable variety that includes the setter on the same object. Sometimes you want to pass around a two-way binding and this is what SettableState is for.

```jsx
import { createSettableState, fromSettable, toSettable } from "@manyducks.co/dolla";

// Settable states can be set by passing a value when they are called.
const $$value = createSettableState("Test");
$$value(); // "Test"
$$value("New Value");
$$value(); // "New Value"

// They can also be split into a State and Setter
const [$value, setValue] = fromSettableState($$value);

// And a State and Setter can be combined into a SettableState.
const $$otherValue = toSettableState($value, setValue);

// Or discard the setter and make it read-only using the good old toState function:
const $value = toState($$value);
```

You can also do weird proxy things like this:

```jsx
// Create an original place for the state to live
const [$value, setValue] = createState(5);

// Derive a state that doubles the value
const $doubled = derive([$value], (value) => value * 2);

// Create a setter that takes the doubled value and sets the original $value accordingly.
const setDoubled = createSetter($doubled, (next, current) => {
  setValue(next / 2);
});

// Bundle the derived state and setter into a SettableState to pass around.
const $$doubled = toSettableState($doubled, setDoubled);

// Setting the doubled state...
$$doubled(100);

// ... will be reflected everywhere.
$$doubled(); // 100
$doubled(); // 100
$value(); // 50
```
