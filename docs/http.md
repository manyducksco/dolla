# The HTTP Client

Every app needs to talk to a server at some point, and while you _could_ just use the browser's built-in `fetch`, it's kinda basic. You end up writing the same boilerplate code over and over again for things like setting headers and parsing JSON. It's a vibe killer.

That's why Dolla comes with its own `http` client right out of the box. It's a smart wrapper around `fetch` that makes your life way easier.

**Why you'll actually wanna use it:**

- **Automatic JSON:** It automatically stringifies your request bodies to JSON and parses JSON responses. No more `.then(res => res.json())` chains\!
- **Middleware:** This is the main event. You can set up "middleware" functions that run on _every single request_. This is clutch for adding auth tokens, logging, or handling errors in one central place.
- **Clean API:** It's just simple. `http.get('/users')` is way cleaner than a big `fetch` call.
- **Smart Error Handling:** It automatically throws an error for bad responses (like 404s or 500s), so you don't have to check `res.ok` yourself.

## Basic Requests

The `http` object is a global singleton, so you just import it and go. It has methods for all the common HTTP verbs.

```jsx
import { http } from "@manyducks.co/dolla/http";
import { useSignal, useMount } from "@manyducks.co/dolla";

function UserList() {
  const [$users, setUsers] = useSignal([]);

  useMount(async () => {
    // Just call the method you need!
    const res = await http.get("/api/users");
    // The body is already parsed JSON!
    setUsers(res.body);
  });

  return (
    <ul>
      <For each={$users}>{(user) => <li>{() => user().name}</li>}</For>
    </ul>
  );
}
```

Here are the main methods you'll use:

- `http.get(uri, options?)`
- `http.post(uri, options?)`
- `http.put(uri, options?)`
- `http.patch(uri, options?)`
- `http.delete(uri, options?)`

## Passing Options to a Request

For anything more than a simple GET request, you'll need to pass an `options` object. This is where you put your request body, headers, and query params.

### Sending a `body`

When you use `post`, `put`, or `patch`, you'll probably wanna send some data. Just put your JavaScript object in the `body` property. Dolla will automatically set the `Content-Type` to `application/json` and `JSON.stringify` it for you.

```jsx
const handleCreateUser = async () => {
  const newUser = { name: "Alice", email: "alice@example.com" };

  try {
    const res = await http.post("/api/users", {
      body: newUser,
    });
    console.log("User created!", res.body);
  } catch (error) {
    console.error("Failed to create user:", error);
  }
};
```

### Adding `headers`

You can pass a plain object for your headers.

```jsx
const res = await http.get("/api/some-protected-route", {
  headers: {
    "X-Custom-Header": "MyValue",
  },
});
```

### Adding `query` Params

Don't mess with building query strings by hand. Just pass an object to the `query` property and Dolla will build the URL for you.

```jsx
// This will make a request to /api/users?sort=name&limit=10
const res = await http.get("/api/users", {
  query: {
    sort: "name",
    limit: 10,
  },
});
```

## Middleware: The Secret Sauce

This is the best part. Middleware is a function that can intercept _every single request_ before it goes out. You can inspect it, change it, or even stop it. It's perfect for stuff you need to do all the time.

You add middleware with `http.use(myMiddleware)`.

### Example: The Auth Header

This is the classic use case. You need to add a `Bearer` token to every request that goes to your API. Instead of adding it to every single call, you just set up a middleware once.

```jsx
import { http } from "@manyducks.co/dolla/http";

// This middleware will run for EVERY http call
http.use(async (req, next) => {
  // Check if the request is going to our API
  if (req.url.pathname.startsWith("/api/")) {
    const token = localStorage.getItem("auth_token");
    if (token) {
      // Add the auth header!
      req.headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // This part is super important! You HAVE to call next()
  // to let the request continue on its way.
  await next();
});

// Now, this request will automatically have the auth header.
const profile = await http.get("/api/me");
```

The `http.use()` function also returns a function that you can call to **remove** that specific middleware later if you need to.

## Handling Responses

When a request is successful, you get a response object back with all the info you need:

- `res.body`: The response body, already parsed for you (usually as JSON).
- `res.status`: The HTTP status code (e.g., `200`).
- `res.statusText`: The status text (e.g., `"OK"`).
- `res.headers`: A `Headers` object with all the response headers.
- `res.url`: The final `URL` object of the request.
- `res.method`: The HTTP method that was used.

## Error Handling

Dolla's HTTP client makes error handling way easier. If a request gets a response with a status code in the 400s or 500s (like a `404 Not Found` or `500 Server Error`), it will automatically **throw an error**.

This means you can use a standard `try...catch` block to handle both network failures and bad HTTP responses in the same place.

The error it throws is a special `HTTPResponseError`. The cool part is that the error object itself has a `.response` property, so you can still inspect the full response body, headers, and status, even on a failed request.

```jsx
const fetchUserData = async (userId) => {
  try {
    const res = await http.get(`/api/users/${userId}`);
    console.log("Got user:", res.body);
  } catch (error) {
    // Check if it's an error from the server
    if (error instanceof HTTPResponseError) {
      console.error(`Server responded with ${error.response.status}`);
      console.error("Response body:", error.response.body); // You can still read the error body!
    } else {
      // It was probably a network error or something else
      console.error("An unexpected error occurred:", error.message);
    }
  }
};

fetchUserData(999); // Let's pretend this user doesn't exist
// Console will log: "Server responded with 404"
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
