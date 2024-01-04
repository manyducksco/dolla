import { Store } from "../../classes/classes/Store.old.js";

export class MockDialogStore extends Store {
  static label = "mock:dialog";

  setup(ctx) {
    return {
      makeDialog(...args) {
        ctx.log("makeDialog called with:", args);
      },
    };
  }
}
