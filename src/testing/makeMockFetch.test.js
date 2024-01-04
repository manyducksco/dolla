import { makeMockFetch } from "./makeMockFetch.js";

test("returning data from a handler sends it as a JSON body", async () => {
  const users = [
    { id: 1, name: "Test Guy" },
    { id: 2, name: "Jimbo Jones" },
    { id: 3, name: "Snorlax" },
  ];

  const fetch = makeMockFetch((ctx) => {
    ctx.get("/users", () => {
      return users;
    });
  });

  const data = await fetch("/users").then((res) => res.json());

  expect(data).toStrictEqual(users);
});

test("return a promise from a handler sends the resolved value as a JSON body", async () => {
  const users = [
    { id: 1, name: "Test Guy" },
    { id: 2, name: "Jimbo Jones" },
    { id: 3, name: "Snorlax" },
  ];

  const fetch = makeMockFetch((ctx) => {
    ctx.get("/users", () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(users);
        }, 100);
      });
    });
  });

  const data = await fetch("/users").then((res) => res.json());

  expect(data).toStrictEqual(users);
});

test("handler can read params and body from context object", async () => {
  const fetch = makeMockFetch((ctx) => {
    ctx.put("/users/:id", (ctx) => {
      ctx.response.status = 201;

      expect(ctx.request.body).toStrictEqual({
        name: "Jimbo Jones",
      });

      return {
        message: `user ${ctx.request.params.id} updated`,
      };
    });
  });

  const res = await fetch("/users/5", {
    method: "put",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Jimbo Jones" }),
  });
  const data = await res.json();

  expect(res.status).toBe(201);
  expect(data).toStrictEqual({
    message: "user 5 updated",
  });
});

test("throws when requesting a route with no defined handler", async () => {
  const fetch = makeMockFetch(function () {
    /* Nothing */
  });

  expect(fetch("/anything")).rejects.toThrow(/Requested URL has no handlers/);
});
