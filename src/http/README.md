# HTTP Client

A simple HTTP client with middleware support.

```ts
import { HTTP } from "@manyducks.co/dolla/http";

const http = new HTTP();

// Typed response body
const user = await http.get("/api/user");
// user.body is typed as `unknown` by default

// With explicit type
const user = await http.get<{ name: string }>("/api/user");
// user.body.name is now typed
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

## Request Options

| Option | Type | Description |
|---|---|---|
| `body` | any | Request body. Plain objects are auto-serialized as JSON. |
| `headers` | `Record<string, any> \| Headers` | Custom headers. |
| `query` | `Record<string, any> \| URLSearchParams` | URL query parameters. |
| `parse` | `(response: Response) => Promise<Body>` | Custom response parser. |
| `signal` | `AbortSignal` | AbortSignal for cancellation. |

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

| Field | Type | Description |
|---|---|---|
| `status` | `number` | HTTP status code |
| `statusText` | `string` | Status text |
| `headers` | `Headers` | Response headers |
| `body` | `Body` | Parsed response body |
| `method` | `string` | Request method |
| `url` | `URL` | Request URL |

Non-OK responses (status >= 400) throw an `HTTPResponseError` with the same response object attached.

## Response body parsing

By default, the client parses the response body based on the `Content-Type` header:
- `application/json` → `response.json()`
- `*/*form*` → `response.formData()`
- everything else → `response.text()`

Override this with a custom `parse` function in the request options.
