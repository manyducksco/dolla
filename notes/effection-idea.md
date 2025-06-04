# Effection Idea

This is probably a different framework, but I've been looking into Effection lately. Effection uses generators to manage async code, guaranteeing that cleanup runs and that you can use synchronous constructs like try/catch as you'd expect. I kind of like it, so I was thinking of adapting dolla views to use generators as well for async mounting and cleanup. It's worth trying just as an experiment and for learning more about generators.

Generators are a poorly understood concept to me and I'm guessing most devs, because I never see them suggested as a solution to any problem in mainstream circles.

```js
const ExampleStore = store(function* () {
  // Yield setup (optional)
  yield* function* () {};

  //
  yield {};

  // Yield teardown (optional)
  yield* function* () {};
});

const ExampleView = view(function* () {
  yield* provide(ExampleStore);

  const example = yield* use(ExampleStore);

  // Yield setup (optional)
  yield* function* () {};

  // Yield markup for rendering.
  // When mounting, the view is considered mounted when the view yields markup.
  yield <div>TEST</div>;

  // Yield teardown (optional)
  yield* function* () {};
});
```
