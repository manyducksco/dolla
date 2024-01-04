import { Store } from "../../classes/classes/Store.old.js";

export class MockHTTPStore extends Store {
  static label = "mock:http";

  setup(ctx) {
    function explode() {
      throw new Error("Override the 'http' store with a mock to use 'http' in a wrapper.");
    }

    return {
      request: explode,
      use: explode,
      get: explode,
      put: explode,
      patch: explode,
      post: explode,
      delete: explode,
      head: explode,
    };
  }
}
