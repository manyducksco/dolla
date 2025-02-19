import { isObject } from "../typeChecking.js";
// import type { Dolla, Logger } from "../core/dolla.js";

/**
 * A simple HTTP client with middleware support. Middleware applies to all requests made through this store,
 * so it's the perfect way to handle things like auth headers and permission checks for API calls.
 */
export class HTTP {
  #middleware: HTTPMiddleware[] = [];
  #fetch = getDefaultFetch();
  // #dolla: Dolla;
  // #logger: Logger;

  constructor() {
    // this.#dolla = dolla;
    // this.#logger = dolla.createLogger("Dolla.http");
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
    const runner = new Runner<ResBody, ReqBody>({
      ...options,
      method,
      uri,
      middleware: this.#middleware,
      fetch: this.#fetch,
    });
    return runner.fetch();
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
  url: URL;
  headers: Headers;
  body: Body;
}

export interface HTTPResponse<Body> {
  method: string;
  url: URL;
  headers: Headers;
  status: number;
  statusText: string;
  body: Body;
}

interface MakeRequestConfig<ReqBody> extends RequestOptions<ReqBody> {
  method: string;
  uri: string;
  middleware: HTTPMiddleware[];
  fetch: typeof window.fetch;
}

export class HTTPResponseError extends Error {
  response;

  constructor(response: HTTPResponse<any>) {
    const { status, statusText, method, url } = response;
    const message = `${status} ${statusText}: Request failed (${method.toUpperCase()} ${url.toString()})`;

    super(message);

    this.response = response;
  }
}

class Request<ReqBody> implements HTTPRequest<ReqBody> {
  method: string;
  url: URL;
  headers = new Headers();
  body!: ReqBody;

  get isSameOrigin() {
    return this.url.origin === window.location.origin;
  }

  constructor(config: MakeRequestConfig<ReqBody>) {
    this.method = config.method;
    this.body = config.body!;
    if (config.uri.startsWith("http")) {
      this.url = new URL(config.uri);
    } else {
      this.url = new URL(config.uri, window.location.origin);
    }

    this._applyHeaders(config.headers);
    this._applyQueryParams(config.query);
  }

  private _applyHeaders(headers: any) {
    if (headers == null) return;

    if (headers instanceof Map || headers instanceof Headers) {
      headers.forEach((value, key) => {
        this.headers.set(key, value);
      });
    } else if (isObject(headers)) {
      for (const name in headers) {
        const value = headers[name];
        if (value instanceof Date) {
          this.headers.set(name, value.toISOString());
        } else if (value != null) {
          this.headers.set(name, String(value));
        }
      }
    } else {
      throw new TypeError(`Unknown headers type. Got: ${headers}`);
    }
  }

  private _applyQueryParams(query: any) {
    if (query == null) return;

    if (query instanceof Map || query instanceof URLSearchParams) {
      query.forEach((value, key) => {
        this.url.searchParams.set(key, value);
      });
    } else if (isObject(query)) {
      for (const name in query) {
        const value = query[name];
        if (value instanceof Date) {
          this.url.searchParams.set(name, value.toISOString());
        } else if (value != null) {
          this.url.searchParams.set(name, String(value));
        }
      }
    } else {
      throw new TypeError(`Unknown query params type. Got: ${query}`);
    }
  }
}

class Runner<ResBody, ReqBody> {
  private _middleware;
  private _fetch;

  private _request: Request<ReqBody>;
  private _response?: HTTPResponse<ResBody>;

  constructor(config: MakeRequestConfig<ReqBody>) {
    this._middleware = config.middleware;
    this._fetch = config.fetch;

    this._request = new Request(config);
  }

  async fetch() {
    if (this._middleware.length > 0) {
      const mount = (index = 0) => {
        const current = this._middleware[index];
        const next = this._middleware[index + 1] ? mount(index + 1) : this._handler.bind(this);

        return async () =>
          current(this._request, async () => {
            await next();
            return this._response!;
          });
      };

      await mount()();
    } else {
      await this._handler();
    }

    if (this._response!.status < 200 || this._response!.status >= 400) {
      throw new HTTPResponseError(this._response!);
    }

    return this._response!;
  }

  // This is the function that performs the actual request after the final middleware.
  private async _handler() {
    let reqBody: BodyInit;

    const req = this._request;

    if (!req.headers.has("content-type") && isObject(req.body)) {
      // Auto-detect JSON bodies and encode as a string with correct headers.
      req.headers.set("content-type", "application/json");
      reqBody = JSON.stringify(req.body);
    } else {
      reqBody = req.body as BodyInit;
    }

    const fetched = await this._fetch(req.url.toString(), {
      method: req.method,
      headers: req.headers,
      body: reqBody,
    });

    // Auto-parse response body based on content-type header
    const contentType = fetched.headers.get("content-type");

    let body: ResBody;

    if (contentType?.includes("application/json")) {
      body = await fetched.json();
    } else if (contentType?.includes("application/x-www-form-urlencoded")) {
      body = (await fetched.formData()) as ResBody;
    } else {
      body = (await fetched.text()) as ResBody;
    }

    this._response = {
      method: req.method,
      url: req.url,
      status: fetched.status,
      statusText: fetched.statusText,
      headers: fetched.headers,
      body,
    };
  }
}

// async function makeRequest<ResBody, ReqBody>(config: MakeRequestConfig<ReqBody>) {
//   const { headers, query, fetch, middleware, logger } = config;

//   const request: HTTPRequest<ReqBody> = {
//     method: config.method,
//     uri: config.uri,
//     get sameOrigin() {
//       return !request.uri.startsWith("http");
//     },
//     query: new URLSearchParams(),
//     headers: new Headers(),
//     body: config.body!,
//   };

//   // Read headers into request
//   if (headers) {
//     if (headers instanceof Map || headers instanceof Headers) {
//       headers.forEach((value, key) => {
//         request.headers.set(key, value);
//       });
//     } else if (headers != null && typeof headers === "object" && !Array.isArray(headers)) {
//       for (const name in headers) {
//         const value = headers[name];
//         if (value instanceof Date) {
//           request.headers.set(name, value.toISOString());
//         } else if (value != null) {
//           request.headers.set(name, String(value));
//         }
//       }
//     } else {
//       throw new TypeError(`Unknown headers type. Got: ${headers}`);
//     }
//   }

//   // Read query params into request
//   if (query) {
//     if (query instanceof Map || query instanceof URLSearchParams) {
//       query.forEach((value, key) => {
//         request.query.set(key, value);
//       });
//     } else if (query != null && typeof query === "object" && !Array.isArray(query)) {
//       for (const name in query) {
//         const value = query[name];
//         if (value instanceof Date) {
//           request.query.set(name, value.toISOString());
//         } else if (value != null) {
//           request.query.set(name, String(value));
//         }
//       }
//     } else {
//       throw new TypeError(`Unknown query params type. Got: ${query}`);
//     }
//   }

//   let response: HTTPResponse<ResBody>;

//   // This is the function that performs the actual request after the final middleware.
//   const handler = async () => {
//     const query = request.query.toString();
//     const fullURL = query.length > 0 ? request.uri + "?" + query : request.uri;

//     let reqBody: BodyInit;

//     if (!request.headers.has("content-type") && isObject(request.body)) {
//       // Auto-detect JSON bodies and encode as a string with correct headers.
//       request.headers.set("content-type", "application/json");
//       reqBody = JSON.stringify(request.body);
//     } else {
//       reqBody = request.body as BodyInit;
//     }

//     const fetched = await fetch(fullURL, {
//       method: request.method,
//       headers: request.headers,
//       body: reqBody,
//     });

//     // Auto-parse response body based on content-type header
//     const headers = Object.fromEntries<string>(fetched.headers.entries());
//     const contentType = headers["content-type"];

//     let body: ResBody;

//     if (contentType?.includes("application/json")) {
//       body = await fetched.json();
//     } else if (contentType?.includes("application/x-www-form-urlencoded")) {
//       body = (await fetched.formData()) as ResBody;
//     } else {
//       body = (await fetched.text()) as ResBody;
//     }

//     response = {
//       method: request.method,
//       uri: request.uri,
//       status: fetched.status,
//       statusText: fetched.statusText,
//       headers: headers,
//       body,
//     };

//     // logger.info("response", response);
//   };

//   if (middleware.length > 0) {
//     const mount = (index = 0) => {
//       const current = middleware[index];
//       const next = middleware[index + 1] ? mount(index + 1) : handler;

//       return async () =>
//         current(request, async () => {
//           await next();
//           return response;
//         });
//     };

//     await mount()();
//   } else {
//     await handler();
//   }

//   if (response!.status < 200 || response!.status >= 400) {
//     throw new HTTPResponseError(response!);
//   }

//   return response!;
// }
