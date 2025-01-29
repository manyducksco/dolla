import { isObject } from "../typeChecking.js";
import type { Dolla, Logger } from "../core/dolla.js";

/**
 * A simple HTTP client with middleware support. Middleware applies to all requests made through this store,
 * so it's the perfect way to handle things like auth headers and permission checks for API calls.
 */
export class HTTP {
  #middleware: HTTPMiddleware[] = [];
  #fetch = getDefaultFetch();
  #dolla: Dolla;
  #logger: Logger;

  constructor(dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("dolla/http");
  }

  /**
   * Adds a new middleware that will apply to subsequent requests.
   * Returns a function to remove this middleware.
   *
   * @param middleware - A middleware function that will intercept requests.
   */
  use(fn: HTTPMiddleware) {
    this.#middleware.push(fn);

    // Call returned function to remove this middleware for subsequent requests.
    return () => {
      this.#middleware.splice(this.#middleware.indexOf(fn), 1);
    };
  }

  async get<ResBody = unknown>(uri: string, options?: RequestOptions<never>) {
    return this.#request<ResBody, never>("get", uri, options);
  }

  async put<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody>) {
    return this.#request<ResBody, ReqBody>("put", uri, options);
  }

  async patch<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody>) {
    return this.#request<ResBody, ReqBody>("patch", uri, options);
  }

  async post<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody>) {
    return this.#request<ResBody, ReqBody>("post", uri, options);
  }

  async delete<ResBody = unknown>(uri: string, options?: RequestOptions<never>) {
    return this.#request<ResBody, never>("delete", uri, options);
  }

  async head<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody>) {
    return this.#request<ResBody, ReqBody>("head", uri, options);
  }

  async options<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody>) {
    return this.#request<ResBody, ReqBody>("options", uri, options);
  }

  async trace<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody>) {
    return this.#request<ResBody, ReqBody>("trace", uri, options);
  }

  async #request<ResBody, ReqBody>(method: string, uri: string, options?: RequestOptions<any>) {
    return makeRequest<ResBody, ReqBody>({
      ...options,
      method,
      uri,
      middleware: this.#middleware,
      fetch: this.#fetch,
      logger: this.#logger,
    });
  }
}

function getDefaultFetch(): typeof window.fetch {
  if (typeof window !== "undefined" && window.fetch) {
    return window.fetch.bind(window);
  }

  if (typeof global !== "undefined" && global.fetch) {
    return global.fetch.bind(global);
  }

  throw new Error("Running in neither browser nor node. Please run this app in one of the supported environments.");
}

/*====================*\
||      Request       ||
\*====================*/

export type HTTPMiddleware = (
  request: HTTPRequest<unknown>,
  next: () => Promise<HTTPResponse<unknown>>,
) => void | Promise<void>;

export interface RequestOptions<ReqBody> {
  /**
   * Body to send with the request.
   */
  body?: ReqBody;

  /**
   * Headers to send with the request.
   */
  headers?: Record<string, any> | Headers;

  /**
   * Query params to interpolate into the URL.
   */
  query?: Record<string, any> | URLSearchParams;
}

export interface HTTPRequest<Body> {
  method: string;
  uri: string;
  readonly sameOrigin: boolean;
  headers: Headers;
  query: URLSearchParams;
  body: Body;
}

export interface HTTPResponse<Body> {
  method: string;
  uri: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: Body;
}

export class HTTPResponseError extends Error {
  response;

  constructor(response: HTTPResponse<any>) {
    const { status, statusText, method, uri } = response;
    const message = `${status} ${statusText}: Request failed (${method.toUpperCase()} ${uri})`;

    super(message);

    this.response = response;
  }
}

interface MakeRequestConfig<ReqBody> extends RequestOptions<ReqBody> {
  method: string;
  uri: string;
  middleware: HTTPMiddleware[];
  fetch: typeof window.fetch;
  logger: Logger;
}

async function makeRequest<ResBody, ReqBody>(config: MakeRequestConfig<ReqBody>) {
  const { headers, query, fetch, middleware, logger } = config;

  const request: HTTPRequest<ReqBody> = {
    method: config.method,
    uri: config.uri,
    get sameOrigin() {
      return !request.uri.startsWith("http");
    },
    query: new URLSearchParams(),
    headers: new Headers(),
    body: config.body!,
  };

  // Read headers into request
  if (headers) {
    if (headers instanceof Map || headers instanceof Headers) {
      headers.forEach((value, key) => {
        request.headers.set(key, value);
      });
    } else if (headers != null && typeof headers === "object" && !Array.isArray(headers)) {
      for (const name in headers) {
        const value = headers[name];
        if (value instanceof Date) {
          request.headers.set(name, value.toISOString());
        } else if (value != null) {
          request.headers.set(name, String(value));
        }
      }
    } else {
      throw new TypeError(`Unknown headers type. Got: ${headers}`);
    }
  }

  // Read query params into request
  if (query) {
    if (query instanceof Map || query instanceof URLSearchParams) {
      query.forEach((value, key) => {
        request.query.set(key, value);
      });
    } else if (query != null && typeof query === "object" && !Array.isArray(query)) {
      for (const name in query) {
        const value = query[name];
        if (value instanceof Date) {
          request.query.set(name, value.toISOString());
        } else if (value != null) {
          request.query.set(name, String(value));
        }
      }
    } else {
      throw new TypeError(`Unknown query params type. Got: ${query}`);
    }
  }

  let response: HTTPResponse<ResBody>;

  // This is the function that performs the actual request after the final middleware.
  const handler = async () => {
    const query = request.query.toString();
    const fullURL = query.length > 0 ? request.uri + "?" + query : request.uri;

    let reqBody: BodyInit;

    if (!request.headers.has("content-type") && isObject(request.body)) {
      // Auto-detect JSON bodies and encode as a string with correct headers.
      request.headers.set("content-type", "application/json");
      reqBody = JSON.stringify(request.body);
    } else {
      reqBody = request.body as BodyInit;
    }

    const fetched = await fetch(fullURL, {
      method: request.method,
      headers: request.headers,
      body: reqBody,
    });

    // Auto-parse response body based on content-type header
    const headers = Object.fromEntries<string>(fetched.headers.entries());
    const contentType = headers["content-type"];

    let body: ResBody;

    if (contentType?.includes("application/json")) {
      body = await fetched.json();
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      body = (await fetched.formData()) as ResBody;
    } else {
      body = (await fetched.text()) as ResBody;
    }

    response = {
      method: request.method,
      uri: request.uri,
      status: fetched.status,
      statusText: fetched.statusText,
      headers: headers,
      body,
    };

    // logger.info("response", response);
  };

  if (middleware.length > 0) {
    const mount = (index = 0) => {
      const current = middleware[index];
      const next = middleware[index + 1] ? mount(index + 1) : handler;

      return async () =>
        current(request, async () => {
          await next();
          return response;
        });
    };

    await mount()();
  } else {
    await handler();
  }

  if (response!.status < 200 || response!.status >= 400) {
    throw new HTTPResponseError(response!);
  }

  return response!;
}
