# HTTP Client

A simple HTTP client with middleware support.

```ts
import { HTTP } from "@manyducks.co/dolla/http";

const http = new HTTP();

// Typed response body
const user = await http.get("/api/user");
// user.body is typed as `unknown` by default

// With explicit type
const typedUser = await http.get<{ name: string }>("/api/user");
// typedUser.body.name is now typed
```

## Methods

All standard HTTP methods are supported:

```ts
http.get("/data");
http.post("/data", { body: { name: "Alice" } });
http.put("/data/1", { body: { name: "Bob" } });
http.patch("/data/1", { body: { name: "Charlie" } });
http.delete("/data/1");
http.head("/data");
http.options("/data");
http.trace("/data");
```

`trace()` is available for API completeness, but browsers (and many `fetch` implementations) reject `TRACE` requests.

## Base URL and defaults

There is no configurable base URL option. Relative URLs resolve against `window.location.origin` in the browser, or `http://localhost` outside one. Use absolute URLs or a middleware to point requests at another host:

```ts
http.use(async (request, next) => {
  request.url = new URL(request.url.pathname + request.url.search, "https://api.example.com");
  return next();
});
```

The client also has no default-headers or credentials option. Add headers with middleware:

```ts
http.use(async (request, next) => {
  request.headers.set("authorization", `Bearer ${getToken()}`);
  return next();
});
```

`new HTTP({ retry })` is the only constructor option.

## Request Options

| Option    | Type                                     | Description                                                        |
| --------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `body`    | any                                      | Request body. Plain objects are auto-serialized as JSON.           |
| `headers` | `Record<string, any> \| Headers`         | Custom headers.                                                    |
| `query`   | `Record<string, any> \| URLSearchParams` | URL query parameters.                                              |
| `parse`   | `(response: Response) => Promise<Body>`  | Custom parser for the raw `Response`.                              |
| `schema`  | `StandardSchemaV1`                       | Validates the decoded body and replaces it with the schema output. |
| `retry`   | `number`                                 | Number of retries. Defaults to the client setting, or `0`.         |
| `signal`  | `AbortSignal`                            | AbortSignal for cancellation.                                      |

## Retries

Retries are opt-in and disabled by default. Set a client-wide default or override it per request:

```ts
const http = new HTTP({ retry: 2 });

// Up to 3 attempts total
await http.get("/api/data");

// Per-request override
await http.get("/api/data", { retry: 5 });
await http.get("/api/data", { retry: 0 }); // disable for this request
```

Retries apply to idempotent methods (`GET`, `HEAD`, `OPTIONS`, `TRACE`, `PUT`, `DELETE`). `POST` and `PATCH` are not retried, since replaying them may duplicate side effects.

The client retries network errors and these status codes: `408`, `429`, `500`, `502`, `503`, `504`. Aborted requests are never retried.

Backoff starts at 300ms and doubles after each attempt, capped at 30 seconds. For `429` and `503`, the `Retry-After` header is honored (also capped at 30 seconds).

Retry delays are abortable. Middleware, a custom `parse` function, and schema validation run once around the whole retry sequence, not once per attempt. Retried request bodies must be replayable (strings, `FormData`, `Blob`, `ArrayBuffer`); one-shot streams are not supported.

## Middleware

Intercept requests and responses with middleware:

```ts
const logger: HTTPMiddleware = async (request, next) => {
  console.time(request.method + " " + request.url);
  const response = await next();
  console.timeEnd(request.method + " " + request.url);
  return response;
};

const unsub = http.use(logger);
// unsub() to remove the middleware
```

Middleware runs in the order they are added (pipeline). Each middleware can:

- Modify the request before passing it to `next()`
- Intercept and short-circuit by returning a response without calling `next()`
- Transform the response before returning it
- Catch errors from downstream middleware

## Response

Every method returns an `HTTPResponse<Body>`:

| Field        | Type      | Description                                      |
| ------------ | --------- | ------------------------------------------------ |
| `status`     | `number`  | HTTP status code                                 |
| `statusText` | `string`  | Status text                                      |
| `headers`    | `Headers` | Response headers                                 |
| `body`       | `Body`    | Parsed response body                             |
| `method`     | `string`  | Request method                                   |
| `url`        | `URL`     | Final response URL after redirects               |
| `redirected` | `boolean` | Whether the request was redirected at least once |

Non-OK responses (status >= 400) throw an `HTTPResponseError` with the same response object attached.

```ts
import { HTTPResponseError } from "@manyducks.co/dolla/http";

try {
  await http.get("/api/user");
} catch (error) {
  if (error instanceof HTTPResponseError) {
    console.error(error.response.status, error.response.body);
  }
}
```

Cancel a request with an `AbortSignal`:

```ts
const controller = new AbortController();

const request = http.get("/api/search", { signal: controller.signal });
controller.abort();
```

Redirects are followed automatically using the platform's `fetch` defaults. The response reports the final URL and whether a redirect occurred; middleware still sees the original request URL on `request.url`.

## Response body parsing

By default, the client parses the response body based on the `Content-Type` header:

- `application/json` → `response.json()`
- `*/*form*` → `response.formData()`
- everything else → `response.text()`

Override this with a custom `parse` function in the request options. `parse` receives the raw `Response`; use `schema` when you want to validate the decoded body instead.

## Schema-validated JSON

The request promise has a `.json()` method for getting the response body directly. It accepts any [Standard Schema](https://standardschema.dev) validator, including Zod 3.24+, Valibot, and ArkType:

```ts
import { z } from "zod";

const User = z.object({
  id: z.number(),
  name: z.string(),
});

const user = await http.get("/api/user").json(User);
// user is { id: number; name: string }
```

Without a schema, `.json()` returns the body typed by the request's `ResBody`:

```ts
const body = await http.get<{ ok: boolean }>("/api/health").json();
```

`.json()` resolves to the body only. When you also need response metadata, use the `schema` request option:

```ts
const res = await http.get("/api/user", { schema: User });
res.status; // number
res.headers; // Headers
res.body.name; // validated and typed
```

`parse` and `schema` can be combined: `parse` controls decoding from the raw `Response`, then `schema` validates the resulting value.

Schema failures throw `HTTPResponseValidationError`, which includes the issues and the original response:

```ts
import { HTTPResponseValidationError } from "@manyducks.co/dolla/http";

try {
  await http.get("/api/user").json(User);
} catch (error) {
  if (error instanceof HTTPResponseValidationError) {
    console.error(error.issues); // StandardSchemaV1.Issue[]
    console.error(error.response.body); // the invalid value
  }
}
```

Non-2xx responses throw `HTTPResponseError` before schema validation runs.

Call `.json()` directly on the request. Chaining `.then()` first returns a regular `Promise`, which does not have `.json()`.
