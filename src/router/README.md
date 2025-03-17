# Router

Refactor into a generic router.

```js
import { Router } from "@manyducks.co/split";

const router = new Router({
  hash: true,
  routes: [
    {
      pattern: "/",
      view: () => {
        document.body.innerHTML = `<h1>This is the root view</h1>`;
      },
    },
    {
      pattern: "*",
      redirect: "/",
    },
  ],
});

router.on("link", (event) => {
  if (event.element.dataset.something === "ignore") {
    event.preventDefault(); // Stop link interception.
  }
});

router.on("match", (event) => {
  const { path, pattern, params, query, route, layers } = event.match;

  // Do something when the route is successfully matched.

  // `route` is the object provided to the constructor for this route.
  route.view();

  // What about layers?
  event.match.layers; // layers is an array of { id, route } including this route as the last item.

  // Then if you wanted to recursively render from the bottom to the top of the tree
  // you could render each view (assuming it returns an HTML string) and pass that as
  // children to the next one up.
  let children;
  for (const { id, route } of layers.toReversed()) {
    children = route.view({ children });
  }
  document.body.innerHTML = children;
});

router.on("error", (event) => {
  // Theoretical error reporting/logging service.
  logError(event.error);

  // TODO: Try to recover from the error.

  event.preventDefault(); // Stop router from throwing error.
});

// Attach to page and start listening to window history.
router.attach();

// Returns a match object or null.
const match = await router.match("/some/path");
```
