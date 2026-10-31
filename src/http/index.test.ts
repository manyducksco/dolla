import type { StandardSchemaV1 } from "@standard-schema/spec";
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { HTTP, HTTPResponseError, HTTPResponseValidationError } from "./index.js";

function testSchema<T>(
  validate: (value: unknown) => StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>,
): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate,
    },
  };
}

describe("HTTP client", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  const userSchema = testSchema<{ name: string }>((value) => {
    if (typeof value !== "object" || value === null || typeof (value as { name?: unknown }).name !== "string") {
      return { issues: [{ message: "Expected an object with a name", path: ["name"] }] };
    }
    return { value: { name: (value as { name: string }).name } };
  });

  function mockResponse(body: any, options: Partial<ResponseInit> = {}) {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
      ...options,
    });
  }

  function mockRedirectedResponse(body: any, url: string) {
    const response = mockResponse(body);
    Object.defineProperty(response, "url", { value: url, configurable: true });
    Object.defineProperty(response, "redirected", { value: true, configurable: true });
    return response;
  }

  beforeAll(() => {
    originalFetch = window.fetch;
  });

  beforeEach(() => {
    mockFetch = vi.fn();
    window.fetch = mockFetch as typeof globalThis.fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    window.fetch = originalFetch;
  });

  test("GET request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ data: "ok" }));
    const client = new HTTP();
    const res = await client.get("/api/test");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: "ok" });
    expect(mockFetch.mock.calls[0][1].method).toBe("GET");
  });

  test("POST with JSON body serializes and sets content-type", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ id: 1 }));
    const client = new HTTP();
    const body = { name: "test" };
    const res = await client.post("/api/items", { body });
    expect(res.body).toEqual({ id: 1 });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/items");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(JSON.stringify(body));
    expect(opts.headers.get("content-type")).toBe("application/json");
  });

  test("POST serializes object and array bodies when a JSON content-type is set", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();

    await client.post("/api/items", {
      body: { name: "test" },
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    await client.post("/api/items", {
      body: [1, 2],
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const [, first] = mockFetch.mock.calls[0];
    expect(first.body).toBe('{"name":"test"}');
    expect(first.headers.get("content-type")).toBe("application/json; charset=utf-8");

    const [, second] = mockFetch.mock.calls[1];
    expect(second.body).toBe("[1,2]");
    expect(second.headers.get("content-type")).toBe("application/vnd.api+json");
  });

  test("DELETE request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ deleted: true }));
    const client = new HTTP();
    const res = await client.delete("/api/items/1");
    expect(res.body).toEqual({ deleted: true });
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
  });

  test("PUT request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ updated: true }));
    const client = new HTTP();
    const res = await client.put("/api/items/1", { body: { name: "new" } });
    expect(res.body).toEqual({ updated: true });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBe('{"name":"new"}');
  });

  test("PATCH request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ patched: true }));
    const client = new HTTP();
    const res = await client.patch("/api/items/1", { body: { name: "new" } });
    expect(res.body).toEqual({ patched: true });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBe('{"name":"new"}');
  });

  test("OPTIONS request", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const client = new HTTP();
    const res = await client.options("/api/items");
    expect(res.status).toBe(204);
    expect(mockFetch.mock.calls[0][1].method).toBe("OPTIONS");
  });

  test("query parameters passed as object", async () => {
    mockFetch.mockImplementation(async () => mockResponse([]));
    const client = new HTTP();
    await client.get("/api/search", { query: { q: "hello", page: "1" } });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("q=hello");
    expect(url).toContain("page=1");
  });

  test("query URLSearchParams keeps repeated keys", async () => {
    mockFetch.mockImplementation(async () => mockResponse([]));
    const client = new HTTP();
    const params = new URLSearchParams([
      ["tag", "a"],
      ["tag", "b"],
    ]);
    await client.get("/api/items", { query: params });
    const [url] = mockFetch.mock.calls[0];
    expect(new URL(url).searchParams.getAll("tag")).toEqual(["a", "b"]);
  });

  test("query object arrays become repeated keys", async () => {
    mockFetch.mockImplementation(async () => mockResponse([]));
    const client = new HTTP();
    await client.get("/api/items", { query: { tag: ["a", "b"], skip: [null, "c"] } });
    const [url] = mockFetch.mock.calls[0];
    expect(new URL(url).searchParams.getAll("tag")).toEqual(["a", "b"]);
    expect(new URL(url).searchParams.getAll("skip")).toEqual(["c"]);
  });

  test("query options replace same-named params already in the URL", async () => {
    mockFetch.mockImplementation(async () => mockResponse([]));
    const client = new HTTP();
    await client.get("/api/items?page=1&keep=yes", { query: { page: 2 } });
    await client.get("/api/items?tag=x", { query: new URLSearchParams([["tag", "a"], ["tag", "b"]]) });
    const first = new URL(mockFetch.mock.calls[0][0]).searchParams;
    expect(first.getAll("page")).toEqual(["2"]);
    expect(first.get("keep")).toBe("yes");
    expect(new URL(mockFetch.mock.calls[1][0]).searchParams.getAll("tag")).toEqual(["a", "b"]);
  });

  test("custom headers are passed to fetch", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    await client.get("/api/data", { headers: { Authorization: "Bearer token123" } });
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.get("Authorization")).toBe("Bearer token123");
  });

  test("HTTP error throws HTTPResponseError", async () => {
    mockFetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new HTTP();
    await expect(client.get("/api/missing")).rejects.toThrow(HTTPResponseError);
  });

  describe("responses without a JSON body", () => {
    const jsonHeaders = { "content-type": "application/json" };

    test("HEAD with a JSON content-type does not parse the body", async () => {
      mockFetch.mockImplementation(async () => new Response(null, { status: 200, headers: jsonHeaders }));
      const res = await new HTTP().head("/api/items");
      expect(res.status).toBe(200);
      expect(res.body).toBeUndefined();
    });

    test.each([204, 205])("%i with a JSON content-type has an undefined body", async (status) => {
      mockFetch.mockImplementation(async () => new Response(null, { status, headers: jsonHeaders }));
      const res = await new HTTP().delete("/api/items/1");
      expect(res.status).toBe(status);
      expect(res.body).toBeUndefined();
    });

    test("empty 200 JSON body is undefined", async () => {
      mockFetch.mockImplementation(async () => new Response("", { status: 200, headers: jsonHeaders }));
      const res = await new HTTP().post("/api/items", { body: { a: 1 } });
      expect(res.body).toBeUndefined();
    });

    test("non-2xx with an unparseable JSON body still throws HTTPResponseError", async () => {
      mockFetch.mockImplementation(
        async () =>
          new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway", headers: jsonHeaders }),
      );
      const error = await new HTTP().get("/api/data").catch((e) => e);
      expect(error).toBeInstanceOf(HTTPResponseError);
      expect(error.response.status).toBe(502);
      expect(error.response.body).toBe("<html>Bad Gateway</html>");
    });

    test("non-2xx with an empty JSON body throws HTTPResponseError", async () => {
      mockFetch.mockImplementation(
        async () => new Response("", { status: 500, statusText: "Internal Server Error", headers: jsonHeaders }),
      );
      await expect(new HTTP().get("/api/data")).rejects.toThrow(HTTPResponseError);
    });

    test("2xx with invalid JSON still rejects with a SyntaxError", async () => {
      mockFetch.mockImplementation(async () => new Response("{nope", { status: 200, headers: jsonHeaders }));
      await expect(new HTTP().get("/api/data")).rejects.toThrow(SyntaxError);
    });
  });

  test("HTTPResponseError has response property", async () => {
    mockFetch.mockImplementation(
      async () =>
        new Response("{}", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new HTTP();
    const err = await client.get("/api/error").catch((e) => e);
    expect(err).toBeInstanceOf(HTTPResponseError);
    expect(err.response.status).toBe(500);
    expect(err.response.statusText).toBe("Internal Server Error");
  });

  test("custom parse function", async () => {
    mockFetch.mockImplementation(
      async () => new Response("raw text", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new HTTP();
    const res = await client.get("/api/text", {
      parse: async (r: Response) => r.text(),
    });
    expect(res.body).toBe("raw text");
    expectTypeOf(res.body).toEqualTypeOf<string>();
  });

  test("middleware intercepts request and can modify response via side effect", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ data: "actual" }));
    const client = new HTTP();
    let interceptedBody: any;
    client.use(async (req, next) => {
      const res = await next();
      interceptedBody = res.body;
      return res;
    });
    await client.get("/api/data");
    expect(interceptedBody).toEqual({ data: "actual" });
  });

  test("middleware can modify request headers", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    client.use(async (req, next) => {
      req.headers.set("X-Custom", "value");
      return next();
    });
    await client.get("/api/data");
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.get("X-Custom")).toBe("value");
  });

  test("use returns an unsubscribe function", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    const middleware = vi.fn(async (req, next) => next());
    const unsubscribe = client.use(middleware);
    unsubscribe();
    await client.get("/api/data");
    expect(middleware).not.toHaveBeenCalled();
  });

  test("middleware can replace response by returning a new one", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ real: "data" }));
    const client = new HTTP();
    client.use(async (req, next) => {
      await next();
      return {
        method: "GET",
        url: new URL("http://localhost/api"),
        headers: new Headers(),
        status: 200,
        statusText: "OK",
        body: { replaced: true },
        redirected: false,
      };
    });
    const res = await client.get("/api/data");
    expect(res.body).toEqual({ replaced: true });
  });

  test("middleware return undefined falls back to next() result", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ original: "data" }));
    const client = new HTTP();
    client.use(async (req, next) => {
      await next();
      // returns undefined
    });
    const res = await client.get("/api/data");
    expect(res.body).toEqual({ original: "data" });
  });

  test("middleware that returns nothing without calling next() throws", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    client.use(async () => {});
    await expect(client.get("/api/data")).rejects.toThrow(
      "HTTP middleware returned no response; return next() or a response",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("multiple middlewares execute in order", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const order: number[] = [];
    const client = new HTTP();
    client.use(async (_req, next) => {
      order.push(1);
      const res = await next();
      order.push(4);
      return res;
    });
    client.use(async (_req, next) => {
      order.push(2);
      const res = await next();
      order.push(3);
      return res;
    });
    await client.get("/api/data");
    expect(order).toEqual([1, 2, 3, 4]);
  });

  test("uses absolute URLs as-is", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    await client.get("https://example.com/api/data");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.com/api/data");
  });

  test("treats relative paths starting with 'http' as relative", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    await client.get("httpbin/get");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(new URL("/httpbin/get", window.location.origin).toString());
  });

  test("reports the final response URL after redirects", async () => {
    mockFetch.mockImplementation(async () => mockRedirectedResponse({}, "https://example.com/final"));
    const client = new HTTP();
    const res = await client.get("https://example.com/start");
    expect(res.url.toString()).toBe("https://example.com/final");
    expect(res.redirected).toBe(true);
  });

  test("falls back to the request URL when the response URL is unavailable", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    const res = await client.get("/api/data");
    expect(res.url.pathname).toBe("/api/data");
    expect(res.redirected).toBe(false);
  });

  test("GET omits body in fetch", async () => {
    mockFetch.mockImplementation(async () => new Response("ok", { status: 200 }));
    const client = new HTTP();
    // The types forbid a GET body; check the runtime drops one anyway.
    await client.get("/api/items", { body: { ignored: true } } as any);
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });

  test("HEAD omits body in fetch", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));
    const client = new HTTP();
    await client.head("/api/items", { body: { ignored: true } });
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });

  describe(".json()", () => {
    test("returns the parsed body without a schema", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ data: "ok" }));
      const client = new HTTP();
      const body = await client.get<{ data: string }>("/api/data").json();
      expect(body).toEqual({ data: "ok" });
      expectTypeOf(body).toEqualTypeOf<{ data: string }>();
    });

    test("returns the validated body with a schema", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ name: "Ada", extra: true }));
      const client = new HTTP();
      const user = await client.get("/api/user").json(userSchema);
      expect(user).toEqual({ name: "Ada" });
    });

    test("throws HTTPResponseValidationError when validation fails", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ name: 123 }));
      const client = new HTTP();
      const error = await client
        .get("/api/user")
        .json(userSchema)
        .catch((e) => e);
      expect(error).toBeInstanceOf(HTTPResponseValidationError);
      expect(error.issues).toEqual([{ message: "Expected an object with a name", path: ["name"] }]);
      expect(error.response.body).toEqual({ name: 123 });
      expect(error.message).toContain("name: Expected an object with a name");
    });

    test("supports async validation", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ name: "Ada" }));
      const client = new HTTP();
      const asyncSchema = testSchema<{ name: string }>(async (value) => {
        await Promise.resolve();
        return typeof (value as { name?: unknown })?.name === "string"
          ? { value: { name: (value as { name: string }).name } }
          : { issues: [{ message: "Expected a name", path: ["name"] }] };
      });
      const user = await client.get("/api/user").json(asyncSchema);
      expect(user).toEqual({ name: "Ada" });
    });

    test("parses JSON strings from non-JSON responses", async () => {
      mockFetch.mockImplementation(
        async () =>
          new Response(JSON.stringify({ name: "Ada" }), {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      );
      const client = new HTTP();
      const user = await client.get("/api/user").json(userSchema);
      expect(user).toEqual({ name: "Ada" });
    });

    test("non-OK responses reject with HTTPResponseError", async () => {
      mockFetch.mockImplementation(
        async () =>
          new Response(JSON.stringify({ name: 123 }), {
            status: 404,
            statusText: "Not Found",
            headers: { "content-type": "application/json" },
          }),
      );
      const client = new HTTP();
      await expect(client.get("/api/user").json(userSchema)).rejects.toBeInstanceOf(HTTPResponseError);
    });

    test("is still a native Promise", async () => {
      mockFetch.mockImplementation(async () => mockResponse({}));
      const client = new HTTP();
      const request = client.get("/api/data");
      expect(request).toBeInstanceOf(Promise);
      await request;
    });

    test("infers the schema output type", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ name: "Ada" }));
      const client = new HTTP();
      const user = await client.get("/api/user").json(userSchema);
      expectTypeOf(user).toEqualTypeOf<{ name: string }>();
    });
  });

  describe("schema request option", () => {
    test("validates the body and preserves response metadata", async () => {
      mockFetch.mockImplementation(
        async () =>
          new Response(JSON.stringify({ name: "Ada" }), {
            status: 201,
            statusText: "Created",
            headers: { "content-type": "application/json", "x-request-id": "abc" },
          }),
      );
      const client = new HTTP();
      const res = await client.get("/api/user", { schema: userSchema });
      expect(res.status).toBe(201);
      expect(res.statusText).toBe("Created");
      expect(res.headers.get("x-request-id")).toBe("abc");
      expect(res.body).toEqual({ name: "Ada" });
      expectTypeOf(res.body).toEqualTypeOf<{ name: string }>();
    });

    test("supports transforming schemas", async () => {
      mockFetch.mockImplementation(async () => mockResponse('"hello"'));
      const client = new HTTP();
      const lengthSchema = testSchema<number>((value) =>
        typeof value === "string" ? { value: value.length } : { issues: [{ message: "Expected a string" }] },
      );
      const res = await client.get("/api/value", { schema: lengthSchema });
      expect(res.body).toBe(5);
    });

    test("throws HTTPResponseValidationError when validation fails", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ name: 123 }));
      const client = new HTTP();
      const error = await client.get("/api/user", { schema: userSchema }).catch((e) => e);
      expect(error).toBeInstanceOf(HTTPResponseValidationError);
      expect(error.issues).toHaveLength(1);
      expect(error.response.body).toEqual({ name: 123 });
    });

    test("non-OK responses throw HTTPResponseError instead", async () => {
      mockFetch.mockImplementation(
        async () =>
          new Response(JSON.stringify({ name: 123 }), {
            status: 400,
            statusText: "Bad Request",
            headers: { "content-type": "application/json" },
          }),
      );
      const client = new HTTP();
      await expect(client.get("/api/user", { schema: userSchema })).rejects.toBeInstanceOf(HTTPResponseError);
    });

    test("validates after middleware modifies the body", async () => {
      mockFetch.mockImplementation(async () => mockResponse({ real: "data" }));
      const client = new HTTP();
      client.use(async (_req, next) => {
        const res = await next();
        res.body = { name: "From middleware" };
        return res;
      });
      const res = await client.get("/api/user", { schema: userSchema });
      expect(res.body).toEqual({ name: "From middleware" });
    });

    test("composes with a custom parse function", async () => {
      mockFetch.mockImplementation(
        async () =>
          new Response(JSON.stringify({ name: "Ada" }), {
            status: 200,
            headers: { "content-type": "text/plain" },
          }),
      );
      const client = new HTTP();
      const jsonStringSchema = testSchema<{ name: string }>((value) => {
        if (typeof value !== "string") return { issues: [{ message: "Expected a string" }] };
        const parsed = JSON.parse(value) as { name?: unknown };
        if (typeof parsed.name !== "string") return { issues: [{ message: "Expected a name", path: ["name"] }] };
        return { value: { name: parsed.name } };
      });
      const res = await client.get("/api/user", {
        parse: async (r) => r.text(),
        schema: jsonStringSchema,
      });
      expect(res.body).toEqual({ name: "Ada" });
    });
  });

  describe("retries", () => {
    test("retries retryable status codes", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockImplementationOnce(async () => mockResponse({}, { status: 503, statusText: "Service Unavailable" }))
        .mockImplementationOnce(async () => mockResponse({ ok: true }));
      const client = new HTTP();
      const request = client.get("/api/data", { retry: 1 });
      await vi.runAllTimersAsync();
      const res = await request;
      expect(res.body).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test("uses the client retry default", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockImplementationOnce(async () => mockResponse({}, { status: 503 }))
        .mockImplementationOnce(async () => mockResponse({ ok: true }));
      const client = new HTTP({ retry: 1 });
      const request = client.get("/api/data");
      await vi.runAllTimersAsync();
      const res = await request;
      expect(res.body).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test("per-request retry overrides the client default", async () => {
      mockFetch.mockImplementation(async () => mockResponse({}, { status: 503 }));
      const client = new HTTP({ retry: 2 });
      await expect(client.get("/api/data", { retry: 0 })).rejects.toBeInstanceOf(HTTPResponseError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("stops after the configured retry limit", async () => {
      vi.useFakeTimers();
      mockFetch.mockImplementation(async () => mockResponse({}, { status: 503 }));
      const client = new HTTP();
      const request = client.get("/api/data", { retry: 2 });
      const assertion = expect(request).rejects.toBeInstanceOf(HTTPResponseError);
      await vi.runAllTimersAsync();
      await assertion;
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test("does not retry non-retryable status codes", async () => {
      mockFetch.mockImplementation(async () => mockResponse({}, { status: 400, statusText: "Bad Request" }));
      const client = new HTTP();
      await expect(client.get("/api/data", { retry: 2 })).rejects.toBeInstanceOf(HTTPResponseError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("does not retry POST", async () => {
      mockFetch.mockImplementation(async () => mockResponse({}, { status: 503 }));
      const client = new HTTP();
      await expect(client.post("/api/data", { body: {}, retry: 2 })).rejects.toBeInstanceOf(HTTPResponseError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("retries network errors", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockRejectedValueOnce(new TypeError("Network failure"))
        .mockImplementationOnce(async () => mockResponse({ ok: true }));
      const client = new HTTP();
      const request = client.get("/api/data", { retry: 1 });
      await vi.runAllTimersAsync();
      const res = await request;
      expect(res.body).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test("aborts during the retry delay", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      mockFetch.mockImplementation(async () => mockResponse({}, { status: 503 }));
      const client = new HTTP();
      const request = client.get("/api/data", { retry: 2, signal: controller.signal });
      const assertion = expect(request).rejects.toMatchObject({ name: "AbortError" });
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();
      await assertion;
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("honors Retry-After", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockImplementationOnce(async () => mockResponse({}, { status: 429, headers: { "retry-after": "1" } }))
        .mockImplementationOnce(async () => mockResponse({ ok: true }));
      const client = new HTTP();
      const request = client.get("/api/data", { retry: 1 });

      await vi.advanceTimersByTimeAsync(999);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      const res = await request;
      expect(res.body).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    test("runs middleware and parse once across attempts", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockImplementationOnce(async () => mockResponse({}, { status: 503 }))
        .mockImplementationOnce(async () => mockResponse({ ok: true }));
      const client = new HTTP();
      const middleware = vi.fn(async (_req, next) => next());
      const parse = vi.fn(async (response: Response) => response.json());
      client.use(middleware);

      const request = client.get("/api/data", { retry: 1, parse });
      await vi.runAllTimersAsync();
      const res = await request;

      expect(res.body).toEqual({ ok: true });
      expect(middleware).toHaveBeenCalledTimes(1);
      expect(parse).toHaveBeenCalledTimes(1);
    });

    test("replays the request body on retries", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockImplementationOnce(async () => mockResponse({}, { status: 503 }))
        .mockImplementationOnce(async () => mockResponse({ ok: true }));
      const client = new HTTP();
      const request = client.put("/api/data", { body: { name: "Ada" }, retry: 1 });
      await vi.runAllTimersAsync();
      await request;

      const firstBody = mockFetch.mock.calls[0][1].body;
      const secondBody = mockFetch.mock.calls[1][1].body;
      expect(firstBody).toBe(JSON.stringify({ name: "Ada" }));
      expect(secondBody).toBe(firstBody);
    });

    test("reports metadata from the final attempt", async () => {
      vi.useFakeTimers();
      mockFetch
        .mockImplementationOnce(async () => mockResponse({}, { status: 503 }))
        .mockImplementationOnce(async () => mockRedirectedResponse({ ok: true }, "https://example.com/final"));
      const client = new HTTP();
      const request = client.get("https://example.com/start", { retry: 1 });
      await vi.runAllTimersAsync();
      const res = await request;

      expect(res.url.toString()).toBe("https://example.com/final");
      expect(res.redirected).toBe(true);
    });
  });
});
