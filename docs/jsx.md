# Using JSX

JSX is optional. Dolla's `html` tagged templates need no compiler; JSX requires the automatic runtime configuration below.

## TypeScript

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

Vite and esbuild read `jsxImportSource` from your TypeScript configuration. No Babel plugin is required.

## Example

```jsx
import { createAtom, createRoot } from "@manyducks.co/dolla";

function Counter() {
  const [count, setCount] = createAtom(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}

await createRoot("#app").mount(Counter);
```

The same reactivity rules apply: `{count}` passes the getter and stays reactive, while `{count()}` is evaluated once.

## More

- [Templates](./templates.md) — props, children, events, attributes, and the run-once model
- [Mental model](./concepts.md) — why views run once
- [Hooks](./hooks.md) — Dolla's lifecycle hooks, not React hooks
