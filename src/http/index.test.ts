import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { HTTP, HTTPResponseError } from "./index.js";

describe("HTTP client", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  function mockResponse(body: any, options: Partial<ResponseInit> = {}) {
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      {
        status: 200,
        headers: { "content-type": "application/json" },
        ...options,
      },
    );
  }

  beforeAll(() => {
    originalFetch = window.fetch;
  });

  beforeEach(() => {
    mockFetch = vi.fn();
    window.fetch = mockFetch;
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
  });

  test("DELETE request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ deleted: true }));
    const client = new HTTP();
    const res = await client.delete("/api/items/1");
    expect(res.body).toEqual({ deleted: true });
  });

  test("PUT request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ updated: true }));
    const client = new HTTP();
    const res = await client.put("/api/items/1", { body: { name: "new" } });
    expect(res.body).toEqual({ updated: true });
  });

  test("PATCH request", async () => {
    mockFetch.mockImplementation(async () => mockResponse({ patched: true }));
    const client = new HTTP();
    const res = await client.patch("/api/items/1", { body: { name: "new" } });
    expect(res.body).toEqual({ patched: true });
  });

  test("HEAD request", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));
    const client = new HTTP();
    const res = await client.head("/api/items");
    expect(res.status).toBe(200);
  });

  test("OPTIONS request", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 204 }));
    const client = new HTTP();
    const res = await client.options("/api/items");
    expect(res.status).toBe(204);
  });

  test("query parameters passed as object", async () => {
    mockFetch.mockImplementation(async () => mockResponse([]));
    const client = new HTTP();
    await client.get("/api/search", { query: { q: "hello", page: "1" } });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("q=hello");
    expect(url).toContain("page=1");
  });

  test("query parameters passed as URLSearchParams", async () => {
    mockFetch.mockImplementation(async () => mockResponse([]));
    const client = new HTTP();
    const params = new URLSearchParams({ filter: "active" });
    await client.get("/api/items", { query: params });
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("filter=active");
  });

  test("custom headers are passed to fetch", async () => {
    mockFetch.mockImplementation(async () => mockResponse({}));
    const client = new HTTP();
    await client.get("/api/data", { headers: { Authorization: "Bearer token123" } });
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.headers.get("Authorization")).toBe("Bearer token123");
  });

  test("HTTP error throws HTTPResponseError", async () => {
    mockFetch.mockImplementation(async () =>
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        statusText: "Not Found",
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new HTTP();
    await expect(client.get("/api/missing")).rejects.toThrow(HTTPResponseError);
  });

  test("HTTPResponseError has response property", async () => {
    mockFetch.mockImplementation(async () =>
      new Response("{}", {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new HTTP();
    try {
      await client.get("/api/error");
    } catch (e) {
      const err = e as HTTPResponseError;
      expect(err.response.status).toBe(500);
      expect(err.response.statusText).toBe("Internal Server Error");
    }
  });

  test("custom parse function", async () => {
    mockFetch.mockImplementation(async () =>
      new Response("raw text", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new HTTP();
    const res = await client.get("/api/text", {
      parse: async (r: Response) => r.text(),
    });
    expect(res.body).toBe("raw text");
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
      return { method: "GET", url: new URL("http://localhost/api"), headers: new Headers(), status: 200, statusText: "OK", body: { replaced: true } };
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

  test("GET omits body in fetch", async () => {
    mockFetch.mockImplementation(async () => new Response("ok", { status: 200 }));
    const client = new HTTP();
    await client.get("/api/items");
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });

  test("HEAD omits body in fetch", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));
    const client = new HTTP();
    await client.head("/api/items");
    const [_, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });
});
