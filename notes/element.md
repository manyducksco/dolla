```js
class Counter extends ElementWithAttrs(["whatever"]) {
  create() {
    $setup(() => {
      // Hooks can run inside the create() scope
    });

    this.getAttribute("whatever"); // returns a string.

    const whatever = this.trackAttribute("whatever");
    whatever(); // is a signal!

    // Or should trackAttribute be a signal getter itself?
    const value = memo(() => Number(this.trackAttribute("value") ?? 0));

    return html` <div>${count}</div> `;
  }
}

defineElement("dolla-counter", Counter);
```
