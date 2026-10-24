# Contributing to the docs

## Structure

- `README.md` is the landing page and learning path.
- `docs/` contains the core guides.
- `src/*/README.md` contains module-specific documentation.
- `docs/rfc/` contains plans and speculative designs. These are not user guides and are not checked by `docs:check`.

Every new page should be linked from the README docs table and from at least one related page.

## Code examples

### JSX is the default

Use JSX for every example that contains markup:

````md
```jsx
function Counter(props, context) {
  const [getCount, setCount] = createAtom(0);
  return <p>{getCount}</p>;
}
```
````

`html` code blocks belong in `docs/html.md`, in the one short "Using the `html` helper" callout in `docs/templates.md`, in explicit JSX ↔ `html` comparisons, and in this page's conventions examples. Do not use `html` for examples on other pages; link to `docs/html.md` instead.

Pure reactivity, utility, HTTP, and configuration examples stay `js` or `ts`. Do not force JSX where there is no markup.

### Getter naming

Name getters with a `get` prefix:

```js
const [getCount, setCount] = createAtom(0);
const getDoubled = compose(() => getCount() * 2);
const getRemaining = compose(() => getItems().filter((item) => !item.done).length);
```

```jsx
<p>Count: {getCount}</p>;
<p>Doubled: {getDoubled}</p>;
```

Do not name a getter like a value. Avoid `const [count, setCount]` in new examples. The `get` prefix makes `${getCount}` read as a getter and `${getCount()}` read as a call.

For list render callbacks, name the item and index getters:

```jsx
{forEach(
  getItems,
  (item) => item.id,
  (getItem, getIndex) => <li>{getIndex}: {() => getItem().text}</li>,
)}
```

### Context

Use the context argument, not `this`:

```jsx
function Counter(props, context) {
  const [getCount, setCount] = createAtom(0);

  onMount(context, () => {
    // ...
  });

  return <p>{getCount}</p>;
}
```

Custom hooks take the context explicitly:

```js
function useCounter(context) {
  const [getCount, setCount] = createAtom(0);
  onCleanup(context, () => {
    // ...
  });
  return { getCount, increment: () => setCount((c) => c + 1) };
}
```

`this` is optional sugar. If an example must show it, use a function declaration and mark the block with `<!-- legacy-this -->` immediately before the fence:

````md
<!-- legacy-this -->
```jsx
function Counter() {
  onMount(this, () => {});
  return <p>Hello</p>;
}
```
````

### JSX props

Use the simpler, HTML-compatible names:

```jsx
<>
  <label for="name" class={["field", { active: getIsActive }]}>
    Name
  </label>
  <input id="name" onClick={() => setCount((c) => c + 1)} />
</>
```

`className` and `htmlFor` also work. Event names are case-insensitive, so `onclick` works too; use `onClick` in examples.

Reactive interpolation follows the same rule as `html`: pass the getter, not the result.

```jsx
<p>{getCount}</p>;          {/* reactive */}
<p>{getCount()}</p>;        {/* static */}
<p>{() => getItem().text}</p>; {/* reactive property access */}
```

### The `html` helper

Use `</>` to close a component with children:

```js
html`<${Card}><p>Hello</p></>`
```

`<//>` is a legacy shorthand and belongs only in `docs/html.md`. Self-closing components use `<${Card} />`.

### Fences and imports

- Label every code fence: `jsx`, `js`, `tsx`, `ts`, `html`, `sh`, `json`, `md`.
- Show imports in the first example on a page. Later examples may omit them with a one-line note.
- Prefer runnable snippets. Use `#app` for root examples and `await createRoot(...).mount(...)`.
- Do not leave invalid placeholders such as `[...]` in code fences.
- Use getters when demonstrating reactivity, and explain the static alternative when it is a common mistake.
- Link to [Templates](./templates.md) for JSX syntax and [HTML templates](./html.md) for the buildless syntax rather than duplicating them.

## Getter rules

- Do not use `&&`, `||`, or ternaries directly on getters inside a template; they evaluate the getter once.
- Do not call a getter in an interpolation or attribute unless the static value is intentional. If it is intentional, label it as static in the example.
- Derive values with `compose`.
- Use `.when(getter)` or `{ class: getter }` for conditional classes.
- Pass getters as props and read them inside a getter or `compose` in the child.
- Event handlers may call getters because they run later, outside the initial render.
- Remember that any function passed as content or as an attribute value is treated as a getter. Use `unwrap` when you need the value in logic.

## Terminology

Use the [Glossary](./glossary.md) as the authority:

- **View** for functions returning markup.
- **Store** for functions returning state/logic.
- **Component** only as the umbrella term.
- **Getter**, **signal**, **atom**, **markup**, **mount/unmount**, and **show/hide/visibility** consistently.
- **Context argument** for `context`; mention `this` only as optional sugar.
- **JSX** for the default template syntax; **`html` helper** for the buildless tagged template.
- Use **`keepAlive`** for the helper and **keep-alive** as the adjective.
- Use **detach / reattach** only for the DOM mechanism.
- Use **`isMounted(context)`** for lifecycle state and **`isVisible(context)`** for visibility.
- Do **not** use park, suspend, or resume for this feature. Reserve capitalized **React Suspense** for React's async feature.

## Checks

Run the docs checks before submitting:

```sh
npm run docs:check
```

The check verifies relative links, heading anchors, balanced code fences, and these conventions:

- no unlabeled code fences;
- no `<//>` outside `docs/html.md`;
- no `onMount(this` / `onCleanup(this` / `onEffect(this` / `addStore(this` / `getStore(this` / `getDebug(this` outside an allowlisted `<!-- legacy-this -->` block;
- no `html` code fences outside `docs/html.md` and `docs/templates.md`;
- no `html` tagged templates in code blocks outside `docs/html.md`, `docs/templates.md`, and this page.

It runs alongside `tsc`, tests, and the build.

## Status notes

Speculative or unimplemented designs belong in `docs/rfc/` with a clear status banner, not next to user guides. See [the docs rewrite plan](./rfc/docs-rewrite.md) for an example.
