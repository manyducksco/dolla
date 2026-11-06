import { describe, expect, test } from "vitest";
import { describeNode } from "./signal-debug.js";

describe("describeNode", () => {
  test("skips frames from the built library when finding where a signal was created", () => {
    const stack = [
      "Error",
      "    at setNodeDebug (http://localhost/node_modules/@manyducks.co/dolla/dist/signals-BTP35H6N.js:10:5)",
      "    at createEffect (http://localhost/node_modules/@manyducks.co/dolla/dist/signals-BTP35H6N.js:20:5)",
      "    at onEffect (http://localhost/node_modules/@manyducks.co/dolla/dist/context-DdWvQyaN.js:30:5)",
      "    at Counter (http://localhost/src/Counter.tsx:4:3)",
    ].join("\n");
    const node: any = { _fn: function effect() {}, _debugContext: { name: "Counter" }, _debugStack: stack };

    expect(describeNode(node)?.creationFrame).toBe("Counter (http://localhost/src/Counter.tsx:4:3)");
  });
});
