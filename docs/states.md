# States

States are observable containers that hold state that can change while the app is running. You can slot them into your views and those elements will be updated any time the state changes thereafter.

```jsx
import { createState, toState, toValue, derive, createWatcher } from "@manyducks.co/dolla";

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
const count = toValue($count);
const bool = toValue(true);

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
