# Docs rewrite plan: priorities 1–4

> **Status: Implemented (Phases 0–4).** The docs have been rewritten. `docs/jsx.md` was folded into Getting started + Templates and removed.
>
> **Scope:** documentation only. No runtime or API changes in this pass.
>
> **Related:** [Docs contributing](../contributing.md), [`scripts/check-docs.mjs`](../../scripts/check-docs.mjs)

## 1. Why this rewrite

The docs are accurate and thorough, but they are shaped like a reference manual. A newcomer has to absorb several interlocking ideas before the first meaningful app, and the examples reinforce the two biggest traps:

1. Getters are named like values (`count`), so `${count()}` looks reasonable.
2. Views are taught through `this`, so arrow functions silently break hooks.

This rewrite attacks the first 30 minutes and the decision space, not the framework's design. It covers priorities 1–4 from the analysis:

1. Getter naming convention (`getCount`, `getItem`).
2. Lead with `(props, context)` instead of `this`.
3. Document `</>` for component children.
4. Add a tutorial, a cheatsheet, and a "coming from React" page.

It also makes **JSX the default example style** everywhere, with a new, complete `html` page that shows the buildless equivalent of every construct.

## 2. Goals and non-goals

### Goals

- A newcomer can go **README → tutorial → first app** without reading more than three pages.
- The correct code looks correct: getters have a `get` prefix, and the context argument is explicit.
- Every markup example is JSX unless the page is specifically about `html`.
- `html` gets a first-class reference with a JSX ↔ `html` equivalence table.
- The docs table becomes a learning path, not a flat list of 20 links.
- The conventions are enforced by `docs:check` so they do not drift.

### Non-goals

- No API changes. Do **not** document `onMount` cleanup, `ref.current`, callable `debounce`/`throttle`, `HTTP` options, router pattern aliases, or the `/internals` split until they exist.
- Do not remove `this`. Document it as optional sugar in one short callout.
- Do not remove or deprecate `html`. It remains the buildless path.
- Do not rewrite the advanced internals content beyond converting code examples.
- Do not bump the package version.

## 3. Decisions locked

| # | Decision | Rationale |
|---|---|---|
| 1 | **JSX is the default in all docs.** Markup examples use ```` ```jsx ```` (or ```` ```tsx ````). | JSX has editor support, type-checking, and a familiar shape. It is the lower-friction default for newcomers. |
| 2 | **`docs/html.md` is a new, complete page.** `docs/templates.md` becomes the JSX template reference. | A single page with both syntaxes would be too large. The buildless path deserves its own page and a dedicated audience. |
| 3 | **Getters are named `getX`.** `getCount`, `getDoubled`, `getItem`, `getUser`, `getItems`. | Makes `${getCount}` read as a getter and `${getCount()}` read as a call. This is the single highest-leverage clarity change. |
| 4 | **Views and stores use `(props, context)`.** `onMount(context, ...)`, `addStore(context, ...)`, `getStore(context, ...)`. | Removes the arrow-function trap and makes hooks composable. `this` is already supported; only the docs change. |
| 5 | **`html` component children close with `</>`.** `<//>` is documented only in `html.md` as a legacy shorthand. | The parser already supports `</>` (verified). It is far more familiar than `<//>`. |
| 6 | **JSX examples use `class`, `for`, and `onClick`.** A note says `className`, `htmlFor`, and lowercase events also work. | Prefer the simpler, more HTML-compatible names. The runtime supports both. |
| 7 | **Code fences are always labeled.** `jsx`, `js`, `tsx`, `ts`, `html`, `sh`, `json`. | Prevents ambiguous snippets and enables future example checks. |
| 8 | **Show imports in the first example of a page.** Later examples may omit them with a one-line note. | Keeps snippets runnable without repeating boilerplate. |
| 9 | **`await createRoot("#app").mount(App)` is the standard mount line.** | Existing convention; no reason to change. |
| 10 | **Fold `docs/jsx.md` into `getting-started.md` and `templates.md`.** Delete the page and update links, or leave a short stub if external links matter. | JSX setup is now part of the default path, not an optional appendix. |
| 11 | **Preserve the current uncommitted edits** in `docs/glossary.md` and `docs/reactivity.md`. | They contain user changes that must not be reverted. |

## 4. Code example style guide

This is the contract for every rewritten page. Add it to `docs/contributing.md` in Phase 0.

### 4.1 Getters

```js
const [getCount, setCount] = createAtom(0);
const getDoubled = compose(() => getCount() * 2);
```

```jsx
<p>Count: {getCount}</p>
<p>Doubled: {getDoubled}</p>
```

Never name a getter like a value in new examples. Avoid `const [count, setCount]`.

For list items:

```jsx
<ul>
  {forEach(
    getItems,
    (item) => item.id,
    (getItem, getIndex) => (
      <li>
        {getIndex}: {() => getItem().text}
      </li>
    ),
  )}
</ul>
```

### 4.2 Context

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

`this` is sugar. Show it only in a short note:

> Views also receive the context as `this`. Use `function View() {}` if you prefer that style; arrow functions do not bind `this`.

### 4.3 Reactive props

```jsx
function Greeting(props) {
  // props.name may be a getter or a plain value.
  return <p>Hello, {props.name}!</p>;
}

// Parent
<Greeting name={getUserName} />
```

When logic needs the value:

```js
const name = unwrap(props.name);
```

### 4.4 JSX prop names

Use the simpler, HTML-compatible names in JSX:

```jsx
<label for="name" class={["field", { active: getIsActive }]}>
  Name
</label>
<input id="name" onClick={() => setCount((c) => c + 1)} />
```

Add one note per relevant page: `className` and `htmlFor` also work. Event names are case-insensitive, so `onclick` works too; use `onClick` in examples.

### 4.5 `html` examples

`html` code blocks appear only in:

- `docs/html.md` (the complete reference and all paired examples).
- One short "Using the `html` helper" callout in `docs/templates.md`, linking to `html.md`.
- A direct before/after comparison where the page is explicitly about both syntaxes.

Every construct in `html.md` gets a JSX block and an `html` block, labeled:

```jsx
// JSX
<Card title="Hello">Content</Card>
```

```js
// html
html`<${Card} title="Hello">Content</>`;
```

### 4.6 What stays plain JS

Pure reactivity, utilities, HTTP, and configuration examples stay `js`/`ts`. Do not force JSX where there is no markup.

## 5. Information architecture

The README docs table becomes three groups:

### Start here

- Getting started
- Tutorial: your first app
- Mental model
- Templates (JSX)
- Reactivity
- Coming from React

### Build

- Components
- Hooks
- Effects
- CSS
- Styled components
- Transitions
- Refs
- Router
- Translate
- HTTP client
- Virtual list

### Reference

- Cheatsheet
- HTML templates (buildless)
- App root
- Debugging
- Utilities
- FAQ
- Glossary
- Advanced internals
- HMR
- Docs contributing

`docs/jsx.md` is folded into Getting started + Templates. If external links matter, keep a 10-line stub that points to those pages.

## 6. Page-by-page plan

| Page | Role after rewrite | Main changes |
|---|---|---|
| `README.md` | Landing + 5-minute quick start | JSX quick start; `(props, context)`; `get` naming; "No build step?" callout linking `html.md`; grouped docs table; links to tutorial, cheatsheet, from-React, html. Remove `onEffect(this, ...)` from the first example. |
| `docs/getting-started.md` | Install, JSX setup, first app, plugins | JSX-first; tsconfig snippet; minimal counter with `(props, context)`; "choose your style" section; plugins with `context`; troubleshooting. Fold in `jsx.md` setup. |
| `docs/tutorial.md` | **New.** 10-minute todo app | 8 steps, one concept each, JSX, `get` naming, `(props, context)`, links to reference pages. |
| `docs/cheatsheet.md` | **New.** Task → code lookup | Top 15 tasks with short JSX snippets and links. |
| `docs/from-react.md` | **New.** Migration guide | Side-by-side React vs Dolla for state, derived state, effects, context, refs, props, lists, conditionals, memoization, async, CSS. |
| `docs/html.md` | **New.** Buildless template reference | Complete `html` syntax; JSX ↔ `html` equivalence table; components, children, events, classes, styles, refs, SVG, multiple roots; limitations; migration; common mistakes. |
| `docs/concepts.md` | Mental model | JSX examples; `get` naming; `(props, context)`; link to `from-react.md`; clarify "any function passed as content is a getter"; keep update-timing section. |
| `docs/templates.md` | JSX template reference | JSX only; props, children, events, attributes, refs, SVG, multiple roots, common mistakes; short `html` callout linking `html.md`; `className`/`htmlFor`. |
| `docs/reactivity.md` | Signals reference | JSX where markup appears; `get` naming; keep pure-JS signal examples; clarify `unwrap` vs `peek`; preserve the user's `subscribe` edit. |
| `docs/effects.md` | Effects reference | JSX; `(props, context)`; `onEffect(context, ...)`; auto-tracking as the default, deps-array as advanced. |
| `docs/components.md` | Views, stores, control flow | JSX; `(props, context)`; `get` naming; stores return `{ getItems, ... }`; move keep-alive edge cases to `advanced.md`; reduce the four-alias table; link `html.md`. |
| `docs/hooks.md` | Hooks reference | `(props, context)`; JSX; add a custom-hooks section; one `this` sugar note; visibility hooks unchanged. |
| `docs/css.md` | CSS reference | JSX; `className`; `class` note; examples use `get` naming. |
| `docs/styled.md` | Styled components | JSX; `className`; examples use `get` naming. |
| `docs/transitions.md` | Transitions | JSX; `(props, context)` where a view is involved. |
| `docs/refs.md` | Refs | JSX; `(props, context)`; fix the `jsx` fence that currently contains `html`; keep the callable ref API (no `.current` yet). |
| `docs/debugging.md` | Debugging | JSX; `getDebug(context)`; `this.name` example becomes `context.name` or stays as a sugar note. |
| `docs/utilities.md` | Utilities | Mostly unchanged; verify links; do not document the callable debounce/throttle until implemented. |
| `docs/root.md` | Root and plugins | JSX; plugin examples use `context`; `(props, context)`. |
| `docs/faq.md` | FAQ / troubleshooting | JSX; `get` naming; rewrite "Why is `this` undefined?" to recommend the context argument; add "Why is my value static?"; link cheatsheet. |
| `docs/glossary.md` | Glossary | Update View/Store/Context definitions to `(props, context)`; add **JSX** and **`html` helper** entries; preserve current edits. |
| `docs/advanced.md` | Advanced internals | JSX where markup appears; add the keep-alive caveats moved from `components.md`; keep the internals reference. |
| `docs/contributing.md` | Docs conventions | Add the style guide from section 4; document the new docs-check rules; update terminology. |
| `docs/jsx.md` | JSX setup | Fold into Getting started + Templates; delete or leave a stub. |
| `src/router/README.md` | Router | JSX; `(props, context)`; `getRouter(context)`; `get` naming; keep `{}` patterns (aliases are not implemented yet). |
| `src/translate/README.md` | Translate | JSX; `(props, context)`; `getTranslate(context)`; `get` naming for `t()` results. |
| `src/http/README.md` | HTTP client | Mostly TypeScript; no JSX needed. Verify links and examples. |
| `src/virtual/README.md` | Virtual list | JSX; `(props, context)`; `get` naming; `getItem` in render callbacks. |
| `docs/hmr.md` | HMR | Config only; verify links. |

## 7. New page outlines

### 7.1 `docs/tutorial.md` — Build your first Dolla app

**Promise:** a working todo app in about 10 minutes.

**Prerequisites:** Node, Vite, the JSX tsconfig from Getting started.

1. **Mount a static view.** Create the Vite project, add `#app`, render `<h1>`. Explain `createRoot(...).mount(...)`.
2. **Add state.** `createAtom`, name it `getItems`/`setItems`, add a button. Introduce the getter rule with `{getItems}`.
3. **Derive a value.** `compose` for the remaining count. Show `getRemaining`.
4. **Render a list.** `forEach` with a key function and `(getItem, getIndex)`. Show the reactive property read `{() => getItem().text}`.
5. **Extract a store.** `addStore(context, TodoStore)` in the parent, `getStore(context, TodoStore)` in the child. Show `(props, context)`.
6. **Pass a reactive prop.** Parent passes `name={getUserName}`; child renders `{props.name}` and uses `unwrap` for logic.
7. **Add lifecycle.** `onMount`, `onCleanup`, `onEffect` with a timer or subscription.
8. **Add CSS.** `css` + `className`, then a small `styled` example.
9. **Where next.** Link to Router, Translate, HTTP, and the cheatsheet.

Each step should include: goal, complete code block, "what changed", "why it works", and a link to the reference page.

### 7.2 `docs/cheatsheet.md` — I want to…

A table of the top tasks, each with a short JSX snippet and a docs link:

- Create state
- Derive state
- Read without tracking
- Batch updates
- Run an effect
- Run code on mount/cleanup
- Show content conditionally
- Render a reactive list
- Share state with a store
- Read a context value
- Access a DOM node
- Pass a reactive prop
- Add a CSS class
- Create a styled component
- Navigate with the router
- Translate a string
- Make an HTTP request
- Show a loading state
- Common mistakes table (promoted from `templates.md`)

### 7.3 `docs/from-react.md` — Coming from React

Side-by-side sections:

| React | Dolla |
|---|---|
| `useState` | `createAtom` |
| `useMemo` | `compose` |
| `useEffect` | `onEffect` / `createEffect` |
| `useContext` | `getStore` / context property |
| `useRef` | `createRef` |
| `useCallback` | A plain function; no re-renders means no referential stability |
| `map` + `key` | `forEach` + key function |
| `&&` / ternary | `showIf` / `branch` |
| Suspense | State + `showIf` (no thrown-promise boundary) |
| Re-render | Getters in the template |
| CSS-in-JS | `css` / `styled` |

Include:

- The one big difference: **the view function runs once**.
- A full counter example in both frameworks.
- A full todo list example in both frameworks.
- A gotchas table: calling getters, `this` vs context, props captured at mount, effects run synchronously, hidden content keeps running.

### 7.4 `docs/html.md` — Templates without a compiler

**Promise:** everything JSX can do, with no JSX transform.

1. **Why use `html`.** Buildless, no compiler config; still needs a bundler for npm imports.
2. **Setup.** `import { html } from "@manyducks.co/dolla"`.
3. **Basic syntax.** Elements, text, attributes, interpolation.
4. **Reactivity.** `${getCount}` vs `${getCount()}`; `() => getItem().text`.
5. **Components.** `<${Card} />`, `<${Card}>...</>`, legacy `<//>`; props; children.
6. **Events.** `onClick`, lowercase `onclick`, event objects.
7. **Classes.** `class`, `className`, arrays, objects, `css` templates.
8. **Styles.** String, object, array, numeric `px` rules.
9. **Refs.** `ref=${inputRef}`.
10. **SVG.** Namespace, camelCase presentation attributes, `foreignObject`.
11. **Comments and whitespace.**
12. **Multiple roots and fragments.**
13. **JSX ↔ `html` equivalence table.** Element, component, props, children, event, class, style, ref, fragment, conditional, list, spread.
14. **Limitations.** No editor type-checking, no prop types, component closing syntax, no JSX tooling; recommended for buildless/prototypes.
15. **Migration.** JSX → `html` and `html` → JSX.
16. **Common mistakes.**
17. **Complete todo app in both styles**, side by side.

The equivalence table is the centerpiece. Every row should have a working JSX snippet and a working `html` snippet.

## 8. Docs check and contributing updates

### 8.1 `scripts/check-docs.mjs`

Add lightweight convention checks:

- **Fail** on `<//>` outside `docs/html.md`.
- **Fail** on unlabeled code fences.
- **Fail** on `onMount(this`, `onCleanup(this`, `onEffect(this`, `addStore(this`, `getStore(this`, or `getDebug(this` outside `docs/html.md` and `docs/glossary.md`, unless the block is marked with a `<!-- legacy-this -->` comment.
- **Warn** on `` html` `` fences outside `docs/html.md` and `docs/templates.md`.
- Keep the existing link, anchor, and fence-balance checks.

### 8.2 `docs/contributing.md`

Add:

- The style guide from section 4.
- The "JSX by default, `html` in `html.md`" rule.
- The `get` naming rule.
- The `(props, context)` rule.
- The `</>` closing-tag rule.
- The code-fence language rule.
- The paired-example rule for `html.md`.
- A note that `docs:check` enforces the mechanical parts.

## 9. Phases and order of work

### Phase 0 — Lock the conventions (S)

- Update `docs/contributing.md`.
- Update `scripts/check-docs.mjs`.
- Run `npm run docs:check` to establish the baseline. Expect failures for existing violations; fix or allowlist them.

### Phase 1 — New pages (M)

- `docs/tutorial.md`
- `docs/cheatsheet.md`
- `docs/from-react.md`
- `docs/html.md`

Write these first; they set the tone and provide link targets for the rest.

### Phase 2 — Core learning path (M)

- `README.md`
- `docs/getting-started.md`
- `docs/concepts.md`
- `docs/templates.md`
- `docs/reactivity.md`
- `docs/effects.md`

### Phase 3 — Build pages (M)

- `docs/components.md`
- `docs/hooks.md`
- `docs/css.md`
- `docs/styled.md`
- `docs/transitions.md`
- `docs/refs.md`
- `docs/debugging.md`
- `docs/root.md`
- `docs/faq.md`
- `docs/glossary.md`
- `docs/advanced.md`

### Phase 4 — Module READMEs (S/M)

- `src/router/README.md`
- `src/translate/README.md`
- `src/virtual/README.md`
- `src/http/README.md` (light touch)

### Phase 5 — QA and polish (S)

- Update all links and anchors.
- Run `npm run docs:check`.
- Run `npx tsc --noEmit` (no code changes, but confirm).
- Run `npx vitest run` (docs-only, but confirm nothing broke).
- Review the new README path end to end.
- Confirm the current uncommitted edits in `docs/glossary.md` and `docs/reactivity.md` survived.

## 10. Definition of done

- `npm run docs:check` passes.
- No `<//>` outside `docs/html.md`.
- No `this`-based hook calls outside the allowed sugar note.
- Every markup example is JSX, except in `docs/html.md` and explicit comparisons.
- The README links to the tutorial, cheatsheet, from-React, and `html` pages.
- `docs/html.md` has a JSX ↔ `html` row for every supported construct.
- The tutorial runs end to end.
- The cheatsheet covers the top 15 tasks.
- The from-React page covers the top 10 differences.
- The glossary reflects the new conventions.
- The current uncommitted edits are preserved.

## 11. Resolved decisions

1. **`docs/jsx.md`:** deleted after folding into Getting started + Templates.
2. **Store getter naming:** `getItems` / `getRemaining` for store properties.
3. **JSX class prop:** `class` / `for` are the defaults; `className` / `htmlFor` also work.
4. **Tutorial stack:** Vite + JSX, with a link to `html.md` for the buildless path.
5. **README quick start:** JSX primary, plus a "No build step?" callout.
6. **API-at-a-glance page:** deferred until the v5 API split.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| JSX-first weakens the buildless pitch. | Keep a prominent "No build step?" callout and a complete `html.md`. Keep the "Buildless templates" feature bullet. |
| `get` prefixes make examples more verbose. | Explain the convention once in Getting started and the cheatsheet; it pays for itself in every reactive example. |
| `(props, context)` is more typing than `this`. | Show custom hooks that take `context` once; the repetition disappears. Keep `this` as a one-line sugar note. |
| A full docs rewrite creates churn and broken links. | Work in phases, update links as pages change, and run `docs:check` after each phase. |
| `html.md` becomes too large. | Lead with the equivalence table and keep prose tight; link to `templates.md` for shared concepts. |
| The docs check becomes too strict and blocks legitimate examples. | Use explicit allowlist comments for the rare legacy/`this` example. |
| Current uncommitted edits are lost. | Check `git diff` before each page rewrite; preserve the user's changes. |
