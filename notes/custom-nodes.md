What if people could define custom Markup nodes and use them in JSX. Alternative to writing a view if you need lighter weight or more custom elements.

```js
class CustomNode implements MarkupNode {
  domNode = document.createElement('div');

  isMounted = false;

  mount(parent, before) {

  }

  unmount(parentIsUnmounting) {

  }
}
```
