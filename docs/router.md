# Router

> TODO: Write me.

This page goes into detail on what you can do with the router.

```js
import Dolla from "@manyducks.co/dolla";

import HomeView from "./views/Home.js";
import AboutView from "./views/About.js";

Dolla.router.setup({
  // Use /#/hash routes to avoid the need to configure a backend.
  // Leave unset or set to false to use standard paths.
  hash: true,

  routes: [
    { path: "/", view: HomeView },
    { path: "/about", view: AboutView },
    { path: "*", redirect: "/" },
  ],
});
```
