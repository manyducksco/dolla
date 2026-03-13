# Hooks

Hooks are functions that take a [Context](./context.md) as the first argument. You can think of them as context utilities; they take the context and do something with it. There are no special rules about when and where to call hooks. The only non-negotiable feature that makes a function a _hook_ is that it takes a Context as the first argument.

Following this convention makes hooks composable. A hook may call other hooks by passing down the context that was passed to it.

## Lifecycle Hooks

Lifecycle hooks primarily deal with running code based on the lifecycle of a component.

- `onMount(context, callback)`
- `onCleanup(context, callback)`
- `onEffect(context, callback)`

## Store Hooks

- `addStore(context, store)`
- `useStore(context, store)`

## Debug

- `useDebug(context, ...tagEntries)`

## Plugin Hooks

- `useRouter(context)`
- `useTranslate(context)`
