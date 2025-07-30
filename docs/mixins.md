# A Deep Dive into Dolla Mixins

Aight, let's talk about one of Dolla's most lowkey powerful features: **Mixins**. They're a sick way to add reusable superpowers directly to your HTML elements. Once you get the hang of them, you'll find all sorts of cool uses for 'em.

## So, what even IS a Mixin?

A Mixin is a function that you can slap onto any DOM element to give it extra behavior. It doesn't render any new HTML itself; instead, it attaches to an existing element (that a View spit out) and enhances it.

Think of it like this:

- A **View** is like the car itself. It has a structure, seats, a steering wheel. It's the thing you see.
- A **Mixin** is like adding a turbocharger, a custom sound system, or underglow lighting to that car. It doesn't change the car's structure, but it gives it new abilities and makes it do cool stuff.

## Why use a Mixin instead of just wrapping everything in a View?

That's the million-dollar question, fr. You _could_ make a `<HoverHighlightable>` View that wraps a `<div>`, but that gets messy fast.

Here's when you should reach for a Mixin:

1.  **The logic is all about ONE element.** If your code is just focused on making a single `<div>` or `<button>` do something cool, a Mixin is perfect. No need to create a whole new component just for that.
2.  **You're not adding new HTML.** Mixins are for adding behavior, not for rendering more stuff. If you need to spit out more `divs` and `spans`, that's a job for a View.
3.  **You wanna share the same behavior everywhere.** Got a cool "fade in on scroll" effect? Make it a mixin, and you can slap it on images, paragraphs, whole sections—anything\! It's way cleaner than copy-pasting logic or making a dozen different wrapper components.

Basically, Mixins are for **behavior**, and Views are for **structure**.

## How to Make a Mixin

Making a mixin is a two-step function dance. It sounds weird, but it's super useful.

1.  The **outer function** is for configuration. It's where you can pass in options to customize the mixin's behavior. This function's job is to return...
2.  The **inner function**. This is the real meat of the mixin. It gets the actual DOM element as an argument, and inside this function, you can use all the Dolla hooks you know and love (`useMount`, `useEffect`, `useSignal`, etc.).

<!-- end list -->

```jsx
// The outer "configuration" function
function myMixin(options) {
  // The inner "attachment" function
  return (element) => {
    // `element` is the real HTML element!
    // You can use hooks in here.
    useMount(() => {
      console.log(`${options.greeting} from my mixin! I'm attached to:`, element);
    });
  };
}
```

### Applying a Mixin

You apply a mixin to an element in your View using the `mixin` prop. Just call the outer function to get the inner function, and Dolla handles the rest.

```jsx
function MyView() {
  return <div mixin={myMixin({ greeting: "What up" })}>I have a mixin!</div>;
}
```

## Examples to Make it Click

### Basic Example: `autofocus`

Let's start with a super simple one. Sometimes you just want an input to be focused the second it appears on the page.

```jsx
import { useMount } from "@manyducks.co/dolla";

function autofocus() {
  return (element) => {
    useMount(() => {
      // Just tell the element to focus itself when it mounts. Done.
      element.focus();
    });
  };
}

// How to use it:
function LoginForm() {
  return <input type="text" placeholder="Username" mixin={autofocus()} />;
}
```

### Real-World Example: `clickOutside`

This is a classic\! You need to close a dropdown or a modal when the user clicks anywhere else on the page. This is a total pain to do with Views, but it's a breeze with a mixin.

```jsx
import { useMount, useSignal, Show } from "@manyducks.co/dolla";

function clickOutside(onOutsideClick) {
  return (element) => {
    useMount(() => {
      const handleClick = (event) => {
        // If the click is outside the element...
        if (!element.contains(event.target)) {
          // ...call the function we were given!
          onOutsideClick();
        }
      };

      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    });
  };
}

// How to use it for a dropdown:
function DropdownMenu() {
  const [$isOpen, setOpen] = useSignal(false);

  return (
    <div class="dropdown-container">
      <button onClick={() => setOpen(true)}>Open Menu</button>
      <Show when={$isOpen}>
        <div class="menu" mixin={clickOutside(() => setOpen(false))}>
          <p>Item 1</p>
          <p>Item 2</p>
        </div>
      </Show>
    </div>
  );
}
```

See how clean that is? The dropdown's logic for opening is in the View, but the reusable "closing" logic is tucked away in a mixin.

### Advanced Example: `lazyLoadImage`

Let's make a mixin that uses the browser's `IntersectionObserver` API to only load an image when it scrolls into view. This is a huge performance win and a perfect job for a mixin.

```jsx
import { useMount } from "@manyducks.co/dolla";

function lazyLoadImage() {
  return (imgElement) => {
    useMount(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          // When the image is visible on screen...
          if (entry.isIntersecting) {
            // ...swap the real image src into place!
            imgElement.src = imgElement.dataset.src;
            // And we're done, so stop watching.
            observer.unobserve(imgElement);
          }
        });
      });

      observer.observe(imgElement);

      return () => observer.disconnect();
    });
  };
}

// How to use it:
function ImageGallery() {
  return (
    <div class="gallery">
      {/* The initial src can be a tiny placeholder */}
      <img mixin={lazyLoadImage()} src="/placeholder.gif" data-src="/real-image-1.jpg" alt="A cool pic" />
      <img mixin={lazyLoadImage()} src="/placeholder.gif" data-src="/real-image-2.jpg" alt="Another cool pic" />
    </div>
  );
}
```

This is peak mixin usage. The logic is 100% about that `<img>` element and its behavior. Making a `<LazyImage>` View for this would be total overkill.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
