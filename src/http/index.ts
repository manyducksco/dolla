import type { StandardSchemaV1 } from "@standard-schema/spec";

export type HTTPMiddleware = (
  request: HTTPRequest<unknown>,
  next: () => Promise<HTTPResponse<unknown>>,
) => Promise<HTTPResponse<unknown> | void> | void;

export interface HTTPOptions {
  /**
   * Default number of retries for requests made by this client. Defaults to 0.
   */
  retry?: number;
}

interface BaseRequestOptions<ReqBody> {
  body?: ReqBody;
  headers?: Record<string, any> | Headers;
  query?: Record<string, any> | URLSearchParams;
  retry?: number;
  signal?: AbortSignal;
}

export type RequestOptions<ReqBody, ResBody> = BaseRequestOptions<ReqBody> &
  (
    | {
        parse?: (response: Response) => Promise<ResBody>;
        schema?: undefined;
      }
    | {
        parse?: (response: Response) => Promise<unknown>;
        schema: StandardSchemaV1<unknown, ResBody>;
      }
  );

export interface HTTPRequest<Body> {
  method: string;
  url: URL;
  headers: Headers;
  body: Body;
  signal?: AbortSignal;
}

export interface HTTPResponse<Body> {
  method: string;
  url: URL;
  headers: Headers;
  status: number;
  statusText: string;
  body: Body;
  redirected: boolean;
}

export interface HTTPResponsePromise<T> extends Promise<HTTPResponse<T>> {
  json(): Promise<T>;
  json<S extends StandardSchemaV1>(schema: S): Promise<StandardSchemaV1.InferOutput<S>>;
}

export class HTTPResponseError extends Error {
  response: HTTPResponse<any>;

  constructor(response: HTTPResponse<any>) {
    super(
      `${response.status} ${response.statusText}: Request failed (${response.method.toUpperCase()} ${response.url.toString()})`,
    );
    this.response = response;
  }
}

export class HTTPResponseValidationError extends Error {
  response: HTTPResponse<unknown>;
  issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(response: HTTPResponse<unknown>, issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    super(
      `Response validation failed (${response.method.toUpperCase()} ${response.url.toString()}): ${formatIssues(issues)}`,
    );
    this.name = "HTTPResponseValidationError";
    this.response = response;
    this.issues = issues;
  }
}

function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map((issue) => {
      const path = (issue.path ?? [])
        .map((segment) => (typeof segment === "object" ? String(segment.key) : String(segment)))
        .join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

async function applySchema<T>(
  response: HTTPResponse<unknown>,
  schema: StandardSchemaV1<unknown, T>,
  value: unknown,
): Promise<T> {
  const result = await schema["~standard"].validate(value);
  if (result.issues) throw new HTTPResponseValidationError(response, result.issues);
  return result.value;
}

function isJsonContentType(headers: Headers): boolean {
  return (headers.get("content-type") ?? "").includes("json");
}

function readJsonBody<T>(response: HTTPResponse<T>): unknown {
  if (isJsonContentType(response.headers)) return response.body;
  return typeof response.body === "string" ? JSON.parse(response.body) : response.body;
}

function withJson<T>(
  promise: Promise<HTTPResponse<T>>,
  requestSchema?: StandardSchemaV1<unknown, T>,
): HTTPResponsePromise<T> {
  const json = async (schema?: StandardSchemaV1): Promise<unknown> => {
    const response = await promise;
    if (!schema) return response.body;
    if (schema === requestSchema) return response.body;
    return applySchema(response, schema, readJsonBody(response));
  };

  Object.defineProperty(promise, "json", {
    value: json,
    enumerable: false,
    configurable: true,
  });

  return promise as HTTPResponsePromise<T>;
}

const RETRY_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE", "PUT", "DELETE"]);
const RETRY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_BASE_DELAY = 300;
const RETRY_MAX_DELAY = 30_000;

function normalizeRetry(value: number | undefined, fallback = 0): number {
  const retry = value ?? fallback;
  return Number.isFinite(retry) ? Math.max(0, Math.floor(retry)) : 0;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

function getRetryDelay(attempt: number, response?: Response): number {
  if (response && (response.status === 429 || response.status === 503)) {
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    if (retryAfter !== null) return Math.min(retryAfter, RETRY_MAX_DELAY);
  }

  return Math.min(RETRY_BASE_DELAY * 2 ** attempt, RETRY_MAX_DELAY);
}

async function discardResponse(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore cancellation failures while preparing to retry.
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });

    if (signal?.aborted) {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(signal.reason);
    }
  });
}

/**
 * A simple HTTP client with middleware support.
 */
export class HTTP {
  #middleware: HTTPMiddleware[] = [];
  #retry: number;
  #fetch =
    typeof window !== "undefined" && window.fetch
      ? window.fetch.bind(window)
      : typeof global !== "undefined" && global.fetch
        ? global.fetch.bind(global)
        : null;

  constructor(options: HTTPOptions = {}) {
    this.#retry = normalizeRetry(options.retry);
    if (!this.#fetch) throw new Error("Fetch API not found. Unsupported environment.");
  }

  use(fn: HTTPMiddleware) {
    this.#middleware.push(fn);
    return () => {
      this.#middleware = this.#middleware.filter((m) => m !== fn);
    };
  }

  get<ResBody = unknown>(uri: string, options?: RequestOptions<never, ResBody>): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, never>("GET", uri, options), options?.schema);
  }
  put<ResBody = unknown, ReqBody = unknown>(
    uri: string,
    options?: RequestOptions<ReqBody, ResBody>,
  ): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, ReqBody>("PUT", uri, options), options?.schema);
  }
  patch<ResBody = unknown, ReqBody = unknown>(
    uri: string,
    options?: RequestOptions<ReqBody, ResBody>,
  ): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, ReqBody>("PATCH", uri, options), options?.schema);
  }
  post<ResBody = unknown, ReqBody = unknown>(
    uri: string,
    options?: RequestOptions<ReqBody, ResBody>,
  ): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, ReqBody>("POST", uri, options), options?.schema);
  }
  delete<ResBody = unknown>(uri: string, options?: RequestOptions<never, ResBody>): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, never>("DELETE", uri, options), options?.schema);
  }
  head<ResBody = unknown, ReqBody = unknown>(
    uri: string,
    options?: RequestOptions<ReqBody, ResBody>,
  ): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, ReqBody>("HEAD", uri, options), options?.schema);
  }
  options<ResBody = unknown, ReqBody = unknown>(
    uri: string,
    options?: RequestOptions<ReqBody, ResBody>,
  ): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, ReqBody>("OPTIONS", uri, options), options?.schema);
  }
  trace<ResBody = unknown, ReqBody = unknown>(
    uri: string,
    options?: RequestOptions<ReqBody, ResBody>,
  ): HTTPResponsePromise<ResBody> {
    return withJson(this.#request<ResBody, ReqBody>("TRACE", uri, options), options?.schema);
  }

  async #fetchWithRetry(req: HTTPRequest<any>, retries: number): Promise<Response> {
    const canRetry = RETRY_METHODS.has(req.method.toUpperCase());
    let attempt = 0;

    while (true) {
      let response: Response;

      try {
        response = await this.#fetch!(req.url.toString(), {
          method: req.method,
          headers: req.headers,
          body: req.body,
          signal: req.signal,
        });
      } catch (error) {
        if (!canRetry || attempt >= retries || isAbortError(error, req.signal)) throw error;
        await sleep(getRetryDelay(attempt), req.signal);
        attempt++;
        continue;
      }

      if (canRetry && attempt < retries && RETRY_STATUS_CODES.has(response.status)) {
        const delay = getRetryDelay(attempt, response);
        await discardResponse(response);
        await sleep(delay, req.signal);
        attempt++;
        continue;
      }

      return response;
    }
  }

  async #request<ResBody, ReqBody>(
    method: string,
    uri: string,
    options: RequestOptions<any, ResBody> = {},
  ): Promise<HTTPResponse<ResBody>> {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(uri, uri.startsWith("http") ? undefined : base);
    const retries = normalizeRetry(options.retry, this.#retry);

    if (options.query) {
      if (options.query instanceof URLSearchParams) {
        options.query.forEach((v, k) => url.searchParams.set(k, v));
      } else {
        for (const [k, v] of Object.entries(options.query)) {
          if (v != null) url.searchParams.set(k, v instanceof Date ? v.toISOString() : String(v));
        }
      }
    }

    const headers = new Headers(options.headers as HeadersInit);

    let body = options.body;
    const isPlainObject = body && typeof body === "object" && body.constructor === Object;

    if (!headers.has("content-type") && (isPlainObject || Array.isArray(body))) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(body);
    }

    const req: HTTPRequest<any> = {
      method,
      url,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      signal: options.signal,
    };

    // Execute middleware
    let index = -1;
    const dispatch = async (i: number): Promise<HTTPResponse<any>> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;

      const mw = this.#middleware[i];
      if (mw) {
        let res: HTTPResponse<any> | undefined;
        const mwResult = await mw(req, async () => {
          res = await dispatch(i + 1);
          return res;
        });
        return mwResult !== undefined ? mwResult : res!;
      }

      // Terminal Request Handler
      const fetched = await this.#fetchWithRetry(req, retries);

      let resBody: any;
      if (options.parse) {
        resBody = await options.parse(fetched);
      } else {
        const type = fetched.headers.get("content-type") || "";
        if (type.includes("json")) resBody = await fetched.json();
        else if (type.includes("form")) resBody = await fetched.formData();
        else resBody = await fetched.text();
      }

      const response: HTTPResponse<any> = {
        method: req.method,
        url: fetched.url ? new URL(fetched.url) : req.url,
        status: fetched.status,
        statusText: fetched.statusText,
        headers: fetched.headers,
        body: resBody,
        redirected: fetched.redirected,
      };

      if (!fetched.ok) throw new HTTPResponseError(response);
      return response;
    };

    const response = await dispatch(0);

    if (options.schema) {
      response.body = await applySchema(response, options.schema, response.body);
    }

    return response;
  }
}
