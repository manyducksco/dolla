# What can we remove?

I still want to get this library with all its features down below 15kb. It's currently at 17.8kb. That said, I don't want to strip out things that are actually useful. The mission of this library is to be batteries-included, which implies some extra weight.

What can be removed without compromising the basics?

## Events?

> 1st ELIMINATED. We're at 16.77kb now.

If we have the ability to get contexts and call methods on them, isn't that just a better version of events?

## Logger / Built-in Crash View

> REDUCED! Removed simple-color-hash in favor of custom OKLCH hash and we're down to 15.9kb.

Logger could be a different package. Crashes could be handled by a crash handler you attach.

```js
Dolla.onCrash((error) => {
  // Do what you will with this error.
});
```

## HTTP Client?

Do we really need this? It's kind of a nice wrapper but the only thing I use the middleware for is to add auth headers for API calls, and it's trivial to write a function around `fetch` that does that. No need for the complexity of middleware.

Not really. Fetch is hella basic. I just tried to write my own trivial wrapper around fetch and it took a little too much thought. I don't want to do that for every project. Adding middleware to authenticate feels trivial with `http`.

## Markup?

Can JSX and `html` return DOM nodes directly? Not really, because views need to be mounted and unmounted like DOM nodes but they don't have the same API. Although I could define a minimal DOM-compatible API so that DOM nodes could directly work.
