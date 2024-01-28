```js
import { View, Store, $, $$ } from "@manyducks.co/dolla";

const SomeView = View("SomeView")
  .props((t) => ({
    // Define prop types which are validated and enforced in dev mode
    $name: t.readable(t.string().optional()).optional(), // Readable<string | undefined> | undefined
  }))
  .build(({ $name }, ctx) => {
    const { $value } = ctx.getStore(SomeStore);

    return <h1>Hello {$name}</h1>;
  });

const SomeStore = Store("SomeStore").build((ctx) => {
  const $$value = $$(0);

  return {
    $value: $($$value),
  };
});
```
