# Glossary

Terms used throughout the Dolla docs.

| Term | Meaning |
|---|---|
| **View** | A function that returns markup. It receives `props` and a `context`, runs once per mount, and uses `this` as the context. See [Components](./components.md#views). |
| **Store** | A function that returns state and logic instead of markup. Created with `addStore`, retrieved with `getStore`, and shared by a subtree. See [Components](./components.md#stores). |
| **Component** | Umbrella term for a View or a Store. |
| **Context** | The prototype-inherited object passed to views and stores. It carries lifecycle state, stores, debug settings, and arbitrary data down the tree. See [Mental model](./concepts.md#context-as-the-wiring-harness). |
| **Props** | The object passed to a View or Store. Props are captured when the component mounts; pass getters for reactive props. See [Templates](./templates.md#props-and-the-run-once-model). |
| **Children** | A special prop containing the renderable content placed between component tags. See [Templates](./templates.md#components). |
| **Signal** | A reactive value primitive. In Dolla, atoms and composed getters are signals. |
| **Atom** | A mutable signal created with `createAtom`. Returns `[getter, setter]`. |
| **Getter** | A function that returns a value and registers itself as a dependency when read inside a tracking context. |
| **Setter** | The write half of an atom. Accepts a replacement value or an updater function. |
| **Composed getter** | A lazy derived getter created with `compose`. It recomputes when a dependency changes and is read. |
| **Effect** | Side-effect code that re-runs when tracked getters change. `createEffect` is standalone; `onEffect` is scoped to a component lifecycle. |
| **Tracking context** | A context where getters are recorded as dependencies: `compose`, effects, template interpolation, reactive attributes, and CSS template functions. See [Mental model](./concepts.md#tracking-contexts). |
| **Markup** | The lightweight description produced by `html`, JSX, or `createMarkup`. It describes elements/components but is not itself a DOM node. |
| **MarkupNode** | The runtime object that mounts, updates, moves, and unmounts a piece of markup. |
| **Renderable** | Any value accepted as content: strings, numbers, DOM nodes, markup, getters, arrays, `null`, `false`, and keep-alive markers. See [Templates](./templates.md#what-can-be-rendered). |
| **Mount / Unmount** | Mounting creates DOM and starts subscriptions. Unmounting removes DOM and disposes contexts, effects, refs, and listeners. |
| **Suspend / Park** | Detaching a `keepAlive` branch from the DOM while keeping its signals, contexts, refs, and effects alive. Suspended content is not unmounted. See [Keep-alive](./components.md#control-flow-helpers). |
| **Keep-alive** | The opt-in behavior enabled by `keepAlive(content)` on a conditional branch side. |
| **Portal** | Content that is logically part of the current tree but rendered into a different DOM parent. See [Portals](./components.md#createportal). |
| **Ref** | A callable container for a DOM node, created with `createRef`, or a callback passed to `ref`. See [Refs](./refs.md). |
| **Key** | A stable identity returned from the key function passed to `forEach`. Items with the same key reuse their DOM nodes. |
| **Batch** | `batch(fn)` groups signal writes so dependent effects run once at the end. |
| **Microtask flush** | The scheduled pass that applies coalesced DOM updates after signal changes. See [When updates run](./concepts.md#when-updates-run). |
| **HMR** | Hot Module Replacement. During development, a changed view function is re-executed and its output replaced. See [HMR](./hmr.md). |
| **Plugin** | A function that receives the root context before mount and attaches framework or app-wide services. It may be async. See [Getting started](./getting-started.md#plugins). |
