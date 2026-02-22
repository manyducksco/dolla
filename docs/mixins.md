# Mixins: Reusable behavior for DOM nodes.

A mixin is a function which takes a reference to the element it's attached to. This function is bound to the lifecycle of the view the element is rendered in, so you are able to use hooks inside of it.

```jsx
function autofocus(element) {
  $setup(() => {
    element.focus();
  });
}

<input type="text" mixin={autofocus} />;
```

More complex mixins that need configuration call for a factory function pattern. You can't change the arguments of the mixin because it's called by the framework, but you can wrap it in another function that takes the arguments you need and reference those inside your mixin code.

```jsx
// Outer function takes options to configure the mixin.
function onClickOutside(callback: () => void) {
  // Inner function is the mixin itself.
  return (element) => {
    const handler = (e: Event) => {
      if (!element.contains(e.target)) {
        callback();
      }
    }

    $setup(() => {
      window.addEventListener("click", handler);
    })

    $teardown(() => {
      window.removeEventListener("click", handler);
    })
  }
}

function DropdownMenu() {
  const isOpen = state(false);

  return (
    <div class="dropdown-container">
      <button onClick={() => isOpen.write(true)}>Open Menu</button>
      <Show when={isOpen}>
        <div class="menu" mixin={onClickOutside(() => isOpen.write(false))}>
          <p>Item 1</p>
          <p>Item 2</p>
        </div>
      </Show>
    </div>
  );
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
