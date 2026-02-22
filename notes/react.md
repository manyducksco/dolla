Ideas for a wrapper to help with gradual migration from React.

```ts
interface ExampleProps {
  count: number;
}

const Example = createReactComponent<ExampleProps>((props, { $hook, render, html }) => {
  props.count.read(); // all props are proxied as readables that update when React renders.

  // Creates a readable that binds to the hook value. The hook function is called in the React context and returned here as a readable.
  // When the react component re-renders, this readable will receive the new value.
  const auth = $hook(useAuth);

  auth.read().whatever;

  return html` <div>Including html function because of JSX conflicts ${render(() => <SomeReactComponent />)}</div> `;
});
```
