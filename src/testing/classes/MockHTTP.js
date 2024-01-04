import { DebugHub } from "../../classes/classes/DebugHub.js";
import { Store } from "../../classes/classes/Store.old.js";
import { HTTPStore } from "../../stores/http.js";
import { makeMockFetch } from "../makeMockFetch.js";

export class MockHTTP extends Store {
  static label = "mock:http";

  #http;

  setup(ctx) {
    const appContext = {
      stores: new Map(),
      debugHub: new DebugHub(),
    };

    const elementContext = {
      stores: new Map(),
    };

    const respond = this.respond.bind(this);
    const fetch = makeMockFetch(respond);

    this.#http = new HTTPStore({
      appContext,
      elementContext,
      channelPrefix: "mock:store",
      label: "http",
      inputs: { fetch },
      inputDefs: HTTPStore.inputs,
    });

    return this.#http.exports;
  }

  respond(to) {
    throw new Error(`This MockHTTP needs a 'respond' method.`);
  }

  async beforeConnect() {
    await super.beforeConnect();
    await this.#http.beforeConnect();
  }

  afterConnect() {
    super.afterConnect();
    this.#http.afterConnect();
  }

  async beforeDisconnect() {
    await super.beforeDisconnect();
    await this.#http.beforeDisconnect();
  }

  afterDisconnect() {
    super.afterDisconnect();
    this.#http.afterDisconnect();
  }
}
