Like `compose` but it takes an initial value and a function that can set its value asynchronously. Its callback is a tracking context, so it will be re-run when signals called within are updated.

```ts
interface MoleculeGetter<T> {
  (): T;
  <X>(source: MaybeReactive<X>): X;
}

interface MoleculeSetter<T> {
  (next: T): void;
}

interface MoleculeFunction<T> {
  (get: MoleculeGetter<T>, set: MoleculeSetter<T>): void | (() => void);
}

function molecule<T>(initialValue: T, fn: MoleculeFunction<T>) {}

const value = molecule(5, (get, set) => {
  // get() returns the current value stored in this hadron
  // get(reactive) returns the value of that reactive and tracks it (== reactive.get())
  // set(value) updates the value stored in this hadron
  // This function will not be called unless there is at least one observer.

  let interval = setInterval(() => {
    set(get() + 1);
  }, 1000);

  // Can return a cleanup function to run between invocations.
  // Also called when the last observer stops observing.
  return () => {
    clearInterval(interval);
  };
});
```
