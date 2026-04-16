# Hooks

Hooks are just functions that take a [Context](./context.md) as the first argument. Following this convention makes hooks composable; a hook can call other hooks by passing the context it was called with.

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
