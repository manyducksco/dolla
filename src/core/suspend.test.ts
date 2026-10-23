import { describe, expect, test, vi } from "vitest";
import { SuspendScope } from "./suspend.js";

describe("SuspendScope", () => {
  test("runs hooks before resources on suspend, and resources before hooks on resume", () => {
    const events: string[] = [];
    const scope = new SuspendScope();

    scope.addHook({
      suspend: () => events.push("hook:suspend"),
      resume: () => events.push("hook:resume"),
    });
    scope.addResource({
      suspend: () => events.push("resource:suspend"),
      resume: () => events.push("resource:resume"),
    });

    scope.suspend();
    expect(events).toEqual(["hook:suspend", "resource:suspend"]);

    events.length = 0;
    scope.resume();
    expect(events).toEqual(["resource:resume", "hook:resume"]);
  });

  test("is idempotent", () => {
    const scope = new SuspendScope();
    const suspend = vi.fn();
    const resume = vi.fn();
    scope.addResource({ suspend, resume });

    scope.suspend();
    scope.suspend();
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(scope.suspended).toBe(true);

    scope.resume();
    scope.resume();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(scope.suspended).toBe(false);
  });

  test("immediately suspends hooks and resources added while suspended", () => {
    const scope = new SuspendScope();
    scope.suspend();

    const hookSuspend = vi.fn();
    const resourceSuspend = vi.fn();
    scope.addHook({ suspend: hookSuspend });
    scope.addResource({ suspend: resourceSuspend, resume: vi.fn() });

    expect(hookSuspend).toHaveBeenCalledTimes(1);
    expect(resourceSuspend).toHaveBeenCalledTimes(1);
  });

  test("skips resources removed during hook notification", () => {
    const scope = new SuspendScope();
    const resourceSuspend = vi.fn();
    const resource = { suspend: resourceSuspend, resume: vi.fn() };

    scope.addResource(resource);
    scope.addHook({ suspend: () => scope.deleteResource(resource) });
    scope.suspend();

    expect(resourceSuspend).not.toHaveBeenCalled();
  });

  test("isolates errors thrown by hooks and resources", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const scope = new SuspendScope();
    const afterHook = vi.fn();
    const afterResource = vi.fn();

    scope.addHook({
      suspend: () => {
        throw new Error("hook boom");
      },
    });
    scope.addHook({ suspend: afterHook });
    scope.addResource({
      suspend: () => {
        throw new Error("resource boom");
      },
      resume: vi.fn(),
    });
    scope.addResource({ suspend: afterResource, resume: vi.fn() });

    scope.suspend();

    expect(afterHook).toHaveBeenCalledTimes(1);
    expect(afterResource).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);

    error.mockRestore();
  });
});
