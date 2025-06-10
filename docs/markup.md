# Markup

Dolla creates a tree of views that manage the DOM, updating attributes and recreating parts of the DOM as signal values change.

```js
import { $, m, render } from "@manyducks.co/dolla";

const $count = $(0);
const labelMarkup = m("span", { children: $count });
// or in JSX:
const labelMarkup = <span>{$count}</span>;

const rendered = render(labelMarkup);

rendered.mount(document.body);
```
