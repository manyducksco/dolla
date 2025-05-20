# HTTP Client

> TODO: Write me.

This page goes into detail on how to use the built in HTTP client.

```js
import { http } from "@manyducks.co/dolla";

http.use(async (req, next) => {
  // Apply auth header to all API routes.
  if (req.url.pathname.startsWith("/api/")) {
    req.headers.set("authorization", `Bearer ${localStorage.getItem("api-key")}`);
  }

  await next();
});

const res = await http.get("/api/some-api-route");
res.body; // body is already parsed as JSON if server responded with JSON
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
