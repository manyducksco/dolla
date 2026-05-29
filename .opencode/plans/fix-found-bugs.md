# Fix Found Bugs

## Bug 1: `compile` crashes on `null`/array translation values

**File:** `src/translate/index.ts:286-288`  
**Issue:** `typeof null === "object"` and `typeof [] === "object"` both enter the `case "object":` branch and call `compile(null)` or `compile([])`, which throws `TypeError: Cannot convert undefined or null to object` on `for (const key in null)`.

**Fix:** Add guard before recursing:

```typescript
case "object": {
  if (strings[key] === null || Array.isArray(strings[key])) {
    throw new Error(
      `Expected to find a string or object at ${[...path, key].join(".")}. Got: ${typeof strings[key]}`,
    );
  }
  entries.push(...compile(strings[key], [...path, key]));
  break;
}
```

## Bug 2: `findIndexAtScroll()` returns phantom index 0 for empty list

**File:** `src/virtual/list.ts:439-453`  
**Issue:** With `totalItems = 0`, `high = -1`, the while-loop doesn't execute and `foundIndex` stays at 0 — but index 0 doesn't exist.

**Fix:** Add early return:

```typescript
function findIndexAtScroll(scrollPos: number, totalItems: number, avg: number): number {
  if (totalItems <= 0) return 0;
  // ... existing binary search ...
}
```

## Bug 3: HTTP middleware return values discarded

**File:** `src/http/index.ts:132-139`  
**Issue:** The `dispatch` loop uses `await mw(req, next)` but ignores `mw`'s return value. It only returns `res` (captured from the `next()` callback). Middleware that returns a modified response has no effect.

**Fix:** Use middleware return value when provided:

```typescript
if (mw) {
  let res: HTTPResponse<any> | undefined;
  const mwResult = await mw(req, async () => {
    res = await dispatch(i + 1);
    return res;
  });
  return mwResult !== undefined ? mwResult : res!;
}
```

## Bug 4: Memory leak in `#applyClasses` / `#applyStyles`

**File:** `src/core/markup/nodes/element.ts:256-299` and lines 218-253 (styles)  
**Issue:** When a signal-emitting class object is replaced, the `localUnsubs.forEach` cleanup calls wrapper functions and tries to delete them from `this.#unsubscribers`, but the wrappers were never added to `#unsubscribers` — only the original `subscribe()` returns were. The `delete` silently fails, leaving stale entries in `#unsubscribers`.

**Fix:** Add the wrapper to `#unsubscribers` instead of the original unsubscribe, so it gets properly removed during cleanup:

In `#applyClasses`:
```typescript
const wrapper = () => {
  element.classList.remove(name);
  unsub();
};
this.#unsubscribers.add(wrapper);
localUnsubs.add(wrapper);
```

Same pattern in `#applyStyles` at lines 236-242:
```typescript
const unsub = subscribe(value, (v) => { ... });
const wrapper = () => {
  if (v) element.style.removeProperty(name);
  unsub();
};
this.#unsubscribers.add(wrapper);
localUnsubs.add(wrapper);
```

Wait, the style version has a different structure. Let me re-read the style subscription code:

```typescript
if (isFunction(value)) {
  const unsub = subscribe(value, (v) => {
    if (v) element.style.setProperty(name, formatValue(name, v), priority);
    else element.style.removeProperty(name);
  });
  this.#unsubscribers.add(unsub);
  localUnsubs.add(unsub);
}
```

In the style version, `localUnsubs.add(unsub)` adds the subscribe return directly (not a wrapper). So when `localUnsubs.forEach` runs:
```typescript
localUnsubs.forEach((unsub) => {
  unsub();
  this.#unsubscribers.delete(unsub);
});
```

Here `unsub` IS the subscribe return, and it IS in `#unsubscribers`. So `delete` works correctly for styles! The style version doesn't have the memory leak.

Wait, let me re-read:

```typescript
// #applyStyles lines 236-242
if (isFunction(value)) {
  const unsub = subscribe(value, (v) => {
    if (v) element.style.setProperty(name, formatValue(name, v), priority);
    else element.style.removeProperty(name);
  });
  this.#unsubscribers.add(unsub);
  localUnsubs.add(unsub);  // ← adds the SAME function reference
}
```

And cleanup:
```typescript
localUnsubs.forEach((unsub) => {
  unsub();
  this.#unsubscribers.delete(unsub);  // succeeds because it IS the same reference
});
```

The style version is correct! Only the class version has the bug because it wraps the unsubscribe in a lambda.

So the fix is only needed in `#applyClasses`, not `#applyStyles`.

Let me verify the class code again:
```typescript
const unsub = subscribe(value, (isActive) => element.classList.toggle(name, !!isActive));
this.#unsubscribers.add(unsub);
localUnsubs.add(() => {
  element.classList.remove(name);
  unsub();
});
```

The wrapper `() => { element.classList.remove(name); unsub(); }` is added to `localUnsubs`, but the original `unsub` (the subscribe return) is in `#unsubscribers`. They are different functions. So `this.#unsubscribers.delete(wrapper)` fails.

Fix in `#applyClasses`:
```typescript
const unsub = subscribe(value, (isActive) => element.classList.toggle(name, !!isActive));
const wrapper = () => {
  element.classList.remove(name);
  unsub();
};
this.#unsubscribers.add(wrapper);
localUnsubs.add(wrapper);
```

## Verification

After applying fixes, run:
```bash
npx vitest run
```
