# Dolla Internals: What the Heck is Markup?

Aight, so you've been writing Views and they spit out JSX and everything just magically shows up on the page. But what's _actually_ happening under the hood? If you're the kind of dev who likes to pop the hood and see how the engine works, this doc is for you.

We're gonna talk about **Markup**. This is some deep-level Dolla lore, so buckle up.

## So, what even IS Markup?

When you write this in your View:

```jsx
<div>Hello, {$name}!</div>
```

That JSX doesn't just become HTML. Before it ever touches the DOM, it gets turned into a tree of JavaScript objects. We call these objects **Markup Nodes**. Think of it like Dolla's own private version of the DOM, but way smarter and built with reactivity in mind from the ground up.

This tree of Markup Nodes is what Dolla actually uses to create, update, and destroy the real HTML elements on your page.

### The `MarkupNode` Abstract Class

At the very bottom of it all is the `MarkupNode` abstract class. Every single thing in the Markup tree, from a simple piece of text to a whole component, is a class that extends `MarkupNode`. It's the blueprint that guarantees every node knows how to do a few basic things:

- `mount(parent, after?)`: Put me on the page.
- `unmount(skipDOM?)`: Take me off the page.
- `move(parent, after?)`: Move me without a full unmount/remount.
- `getRoot()`: Give me my main HTML element.
- `isMounted()`: Am I currently on the page?

Understanding this is key: your entire app is just a tree of these objects calling these methods on each other.

## Why should I care?

Honestly? 99% of the time, you don't need to. This is all internal stuff. But understanding it can help you debug weird issues and really get why Dolla is so fast. It's also just kinda cool to know how your tools work, fr.

## The Different Flavors of Markup Nodes

There are a few different types of nodes in the Markup tree, each with a specific job.

### `ElementNode`

This is the main character. Every time you write a `<div>`, `<p>`, or `<button>`, Dolla creates an `ElementNode`. This is the object that holds onto the real HTML element and is responsible for all the cool stuff you can do with props.

### `DOMNode`

This is the simplest one. It's a lightweight wrapper for any plain ol' DOM node. This includes simple text\! When you write `<div>Hello</div>`, the word "Hello" becomes a native browser `Text` node, which then gets wrapped in a Dolla `DOMNode`. It's the leaf at the very bottom of the tree.

### `DynamicNode`

This is the secret sauce for reactivity. When you put a signal directly in your JSX, like `<p>{$count}</p>`, Dolla wraps it in a `DynamicNode`. Its job is to listen to the signal and swap out its content whenever the signal's value changes.

### `RepeatNode`

This is the powerhouse behind the `<For>` component. It's way smarter than a simple loop and uses a key-based diffing algorithm to make the absolute minimum number of changes to the DOM when the list updates.

### `ViewNode`

When you use one of your own components, like `<MyComponent />`, Dolla creates a `ViewNode`. Its job is to call your component's function, set up a new `Context` for it, and then manage the tree of Markup Nodes that your component returns.

### `PortalNode`

This is the node for the `<Portal>` component. It's special because it mounts its children to a completely different part of the DOM, and it has to handle its own cleanup.

Here's the tea: normally, when a parent element gets yeeted off the page, all its kids go with it automatically. Dolla uses this for a speed boost—it tells the child nodes "don't worry about removing yourselves, I got this." But a Portal's content is living its best life somewhere else in the DOM, like at the end of `<body>`. So when the Portal's _logical_ parent gets removed, its content is left stranded. That's why the `PortalNode` has to do its own cleanup and manually remove its content from wherever it was teleported to. It can't rely on the parent's cleanup crew.

## The Context Tree: The Brains of the Operation

So how does all this stuff actually connect? The secret is the **Context Tree**.

Think of it like this: when Dolla builds your Markup tree, it builds a second, invisible tree right alongside it. Not every node gets its own context, though. Only **`ViewNode`s** and **`ElementNode`s** create a new child context. The other node types, like `DynamicNode` or `RepeatNode`, just hitch a ride on their parent's context.

This parallel tree is the entire brain of a Dolla component.

### How `useStore` and `useContext` Work

Each context object has a link to its parent. This is the whole magic trick.

When you call `useStore(MyStore)`, Dolla is like, "Aight, lemme check the _current_ context for this store... nope. Lemme ask my parent... nope. Lemme ask _their_ parent..." It just keeps climbing up this context tree until it finds the store or hits the top.

And how do hooks like `useContext` know which context they're in? When a `ViewNode` is about to run your component function, it basically shouts "YO, I'M THE ACTIVE CONTEXT NOW\!" into a global, private variable. Then your function runs, all your hooks grab that global context, and when your function is done, the `ViewNode` sets it back to what it was before. It's a clever little trick that makes hooks feel like magic.

### The Lifecycle Connection

The `Context` object is also a tiny state machine that moves through lifecycle states:

`Unmounted` -\> `WillMount` -\> `DidMount` -\> `WillUnmount` -\> `DidUnmount` -\> `Disposed`

When a `MarkupNode`'s `mount()` method is called, it's actually just telling its own `Context` object to emit the `WillMount` event, then it does its DOM stuff, then it tells the context to emit `DidMount`. The `useMount` hook you use in your component is really just a simple wrapper for `context.onLifecycleTransition("didMount", callback)`.

**What's cool for a power user:**

- **Bound Lifecycles:** When you create a Store or a Mixin, its context is "bound" to the parent View's context. This means when the View's context gets the `DidMount` event, the Store's context automatically gets it too. That's how hooks inside Stores and Mixins just work without any extra setup.
- **Smart Effects:** The `useEffect` hook has to be called in the main body of your component function. It tells the context to queue up the effect to run at `WillMount`. For advanced use cases, you can use the lower-level `context.effect()` method from inside a lifecycle hook (like `useMount`), and the context is smart enough to run it immediately since the component is already mounted.

## Putting It All Together

So, when you write a View like this:

```jsx
function MyView() {
  const [$users, setUsers] = useSignal([{ id: 1, name: "Alice" }]);

  return (
    <div class="container">
      <h1>Users</h1>
      <For each={$users} key={(u) => u.id}>
        {($user) => <p>{() => $user().name}</p>}
      </For>
    </div>
  );
}
```

Here's a simplified version of the Markup tree Dolla builds internally. Remember, each of these nodes has its own `Context` object, linked to its parent's.

```
ElementNode(div)
  - ElementNode(h1)
    - DOMNode(Text("Users"))
  - RepeatNode(for the $users signal)
    - ViewNode(for the <p> component instance)
      - ElementNode(p)
        - DynamicNode(for the user's name)
          - DOMNode(Text("Alice"))
```

When you add a new user to the `$users` signal, only the `RepeatNode` gets notified. It then creates a new `ViewNode` for the new user, which in turn creates its own little tree (and its own child context), and mounts it to the DOM. Nothing else on the page has to re-render.

That's the power of the Markup tree. It's a fully reactive, fine-grained representation of your UI that allows for incredibly efficient updates. And now you know what's really going on under the hood.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
