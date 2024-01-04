# Testing Utils

`woofe/testing` includes tools for automated testing.

## Testing globals (and HTTP calls)

```js
import { wrapStore, MockHTTP } from "woofe/testing";

class ExampleHTTP extends MockHTTP {
  respond(on) {
    // Define a mock responder for requests matching 'POST /users/create'
    on.post("/users/create", (req, res) => {
      res.status(200).body({
        user: {
          id: 1,
          name: req.body.name,
          createdAt: new Date(),
        },
      });
    });

    on.delete("/users/:id", (req, res) => {
      res.status(204);
    });
  }
}

// const ExampleHTTP = makeMockHTTP((on) => {
//   // Define a mock responder for requests matching 'POST /users/create'
//   on.post("/users/create", (req, res) => {
//     res.status(200).body({
//       user: {
//         id: 1,
//         name: req.body.name,
//         createdAt: new Date(),
//       },
//     });
//   });

//   on.delete("/users/:id", (req, res) => {
//     res.status(204);
//   });
// });

// A store that makes HTTP calls:
class UserStore extends Store {
  setup(ctx) {
    const http = ctx.useStore("http");

    function createUser(name) {
      return http.post("/users/create", { body: { name } });
    }

    function deleteUser(id) {
      return http.delete(`/users/${id}`);
    }

    return {
      createUser,
      deleteUser,
    };
  }
}

// And to test (pictured in Jest):
test("API calls return expected response", async () => {
  const store = wrapStore(UserStore, {
    stores: [
      {
        store: "http", // You can use the name of a built-in to override it.
        exports: ExampleHTTP,
      },
    ],
  });

  // Run lifecycle hooks
  await store.connect();

  // Access the exported object at 'exports'
  const createRes = await store.exports.createUser("Jimbo Jones");

  expect(createRes.status).toBe(200);
  expect(createRes.body.name).toBe("Jimbo Jones");

  const deleteRes = await store.exports.deleteUser(createRes.body.user.id);

  expect(deleteRes.status).toBe(204);

  await store.disconnect();
});
```

This can also be done with Views. The view wrapper simulates rendering, allowing you to query for "rendered" DOM nodes without actually displaying anything.

```tsx
import test from "ava";
import { wrapView } from "woofe/testing";
import { SomeView } from "./SomeView";

test("works", async (t) => {
  const view = wrapView(SomeView, {
    // Provide options:
    stores: [],
    inputs: {},
  });

  // Set up
  await view.connect();

  // Check that button is not rendered with default inputs.
  t.falsy(view.querySelector("button[data-test-id='the-button']"));

  // Check that button is rendered when showButton is true.
  view.inputs.set("showButton", true);
  t.truthy(view.querySelector("button[data-test-id='the-button']"));

  // Check that button is not rendered when showButton is false.
  view.inputs.set("showButton", false);
  t.falsy(view.querySelector("button[data-test-id='the-button']"));

  // Tear down
  await view.disconnect();
});
```
