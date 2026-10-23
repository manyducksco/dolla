# Contributing to the docs

## Structure

- `README.md` is the landing page and learning path.
- `docs/` contains the core guides.
- `src/*/README.md` contains module-specific documentation.

Every new page should be linked from the README docs table and from at least one related page.

## Code examples

- Assume imports from `@manyducks.co/dolla` unless the snippet shows them; add a line saying so at the top of a page when necessary.
- Prefer runnable snippets. Use `#app` for root examples and `await createRoot(...).mount(...)`.
- Do not leave invalid placeholders such as `[...]` in code fences.
- Use getters (`${count}`, `() => item().name`) when demonstrating reactivity, and explain the static alternative when it is a common mistake.
- Use `onClick` in new examples; lowercase `onclick` also works.
- Link to [Templates](./templates.md) for markup syntax rather than duplicating it.

## Getter rules

- Do not use `&&`, `||`, or ternaries directly on getters inside a template; they evaluate the getter once.
- Do not call a getter in an interpolation or attribute unless the static value is intentional. If it is intentional, label it as static in the example.
- Derive values with `compose`.
- Use `.when(getter)` or `{ className: getter }` for conditional classes.
- Pass getters as props and read them inside a getter or `compose` in the child.
- Event handlers may call getters because they run later, outside the initial render.

## Terminology

Use the [Glossary](./glossary.md) as the authority:

- **View** for functions returning markup.
- **Store** for functions returning state/logic.
- **Component** only as the umbrella term.
- **Getter**, **signal**, **atom**, **markup**, **mount/unmount**, **suspend/park/keep-alive** consistently.

## Checks

Run the docs checks before submitting:

```sh
npm run docs:check
```

The check verifies relative links, heading anchors, and balanced code fences. It runs alongside `tsc`, tests, and the build.

## Status notes

Speculative or unimplemented designs belong in a `docs/rfc/` folder with a clear status banner, not next to user guides.
