export type HTTPMiddleware = (
  request: HTTPRequest<unknown>,
  next: () => Promise<HTTPResponse<unknown>>,
) => Promise<HTTPResponse<unknown> | void> | void;

export interface RequestOptions<ReqBody, ResBody> {
  body?: ReqBody;
  headers?: Record<string, any> | Headers;
  query?: Record<string, any> | URLSearchParams;
  parse?: (response: Response) => Promise<ResBody>;
  signal?: AbortSignal;
}

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

/**
 * A simple HTTP client with middleware support.
 */
export class HTTP {
  #middleware: HTTPMiddleware[] = [];
  #fetch =
    typeof window !== "undefined" && window.fetch
      ? window.fetch.bind(window)
      : typeof global !== "undefined" && global.fetch
        ? global.fetch.bind(global)
        : null;

  constructor() {
    if (!this.#fetch) throw new Error("Fetch API not found. Unsupported environment.");
  }

  use(fn: HTTPMiddleware) {
    this.#middleware.push(fn);
    return () => {
      this.#middleware = this.#middleware.filter((m) => m !== fn);
    };
  }

  async get<ResBody = unknown>(uri: string, options?: RequestOptions<never, ResBody>) {
    return this.#request<ResBody, never>("GET", uri, options);
  }
  async put<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody, ResBody>) {
    return this.#request<ResBody, ReqBody>("PUT", uri, options);
  }
  async patch<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody, ResBody>) {
    return this.#request<ResBody, ReqBody>("PATCH", uri, options);
  }
  async post<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody, ResBody>) {
    return this.#request<ResBody, ReqBody>("POST", uri, options);
  }
  async delete<ResBody = unknown>(uri: string, options?: RequestOptions<never, ResBody>) {
    return this.#request<ResBody, never>("DELETE", uri, options);
  }
  async head<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody, ResBody>) {
    return this.#request<ResBody, ReqBody>("HEAD", uri, options);
  }
  async options<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody, ResBody>) {
    return this.#request<ResBody, ReqBody>("OPTIONS", uri, options);
  }
  async trace<ResBody = unknown, ReqBody = unknown>(uri: string, options?: RequestOptions<ReqBody, ResBody>) {
    return this.#request<ResBody, ReqBody>("TRACE", uri, options);
  }

  async #request<ResBody, ReqBody>(
    method: string,
    uri: string,
    options: RequestOptions<any, ResBody> = {},
  ): Promise<HTTPResponse<ResBody>> {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(uri, uri.startsWith("http") ? undefined : base);

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
        await mw(req, async () => {
          res = await dispatch(i + 1);
          return res;
        });
        return res!;
      }

      // Terminal Request Handler
      const fetched = await this.#fetch!(req.url.toString(), {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: req.signal,
      });

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
        url: req.url,
        status: fetched.status,
        statusText: fetched.statusText,
        headers: fetched.headers,
        body: resBody,
      };

      if (!fetched.ok) throw new HTTPResponseError(response);
      return response;
    };

    return dispatch(0);
  }
}
