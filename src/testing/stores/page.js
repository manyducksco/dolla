import { makeState } from "../../classes/makeState.js";
import { Store } from "../../classes/classes/Store.old.js";

export class MockPageStore extends Store {
  static label = "mock:page";

  setup(ctx) {
    return {
      $$title: makeState("Test"),
      $visibility: makeState("visible").readable(),
    };
  }
}
