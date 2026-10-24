import { describe, expect, test, vi } from "vitest";
import { VisibilityScope } from "./visibility.js";

describe("VisibilityScope", () => {
  test("runs hooks before resources on hide, and resources before hooks on show", () => {
    const events: string[] = [];
    const scope = new VisibilityScope();

    scope.addHook({
      hide: () => events.push("hook:hide"),
      show: () => events.push("hook:show"),
    });
    scope.addResource({
      hide: () => events.push("resource:hide"),
      show: () => events.push("resource:show"),
    });

    // Adding a hook to a visible scope calls show immediately.
    events.length = 0;

    scope.hide();
    expect(events).toEqual(["hook:hide", "resource:hide"]);

    events.length = 0;
    scope.show();
    expect(events).toEqual(["resource:show", "hook:show"]);
  });

  test("is idempotent", () => {
    const scope = new VisibilityScope();
    const hide = vi.fn();
    const show = vi.fn();
    scope.addResource({ hide, show });

    scope.hide();
    scope.hide();
    expect(hide).toHaveBeenCalledTimes(1);
    expect(scope.hidden).toBe(true);

    scope.show();
    scope.show();
    expect(show).toHaveBeenCalledTimes(1);
    expect(scope.hidden).toBe(false);
  });

  test("calls show for hooks added while visible", () => {
    const scope = new VisibilityScope();
    const hide = vi.fn();
    const show = vi.fn();

    scope.addHook({ hide, show });

    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
  });

  test("does not call hide for hooks added while hidden", () => {
    const scope = new VisibilityScope();
    scope.hide();

    const hide = vi.fn();
    scope.addHook({ hide });

    expect(hide).not.toHaveBeenCalled();
  });

  test("hides resources added while hidden, but leaves visible resources alone", () => {
    const scope = new VisibilityScope();
    const hiddenResource = vi.fn();
    const visibleResource = vi.fn();

    const hidden = { hide: hiddenResource, show: vi.fn() };
    const visible = { hide: visibleResource, show: vi.fn() };

    scope.addResource(visible);
    expect(visibleResource).not.toHaveBeenCalled();

    scope.hide();
    expect(visibleResource).toHaveBeenCalledTimes(1);

    scope.addResource(hidden);
    expect(hiddenResource).toHaveBeenCalledTimes(1);
  });

  test("skips resources removed during hook notification", () => {
    const scope = new VisibilityScope();
    const resourceHide = vi.fn();
    const resource = { hide: resourceHide, show: vi.fn() };

    scope.addResource(resource);
    scope.addHook({ hide: () => scope.deleteResource(resource) });
    scope.hide();

    expect(resourceHide).not.toHaveBeenCalled();
  });

  test("isolates errors thrown by hooks and resources", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const scope = new VisibilityScope();
    const afterHook = vi.fn();
    const afterResource = vi.fn();

    scope.addHook({
      hide: () => {
        throw new Error("hook boom");
      },
    });
    scope.addHook({ hide: afterHook });
    scope.addResource({
      hide: () => {
        throw new Error("resource boom");
      },
      show: vi.fn(),
    });
    scope.addResource({ hide: afterResource, show: vi.fn() });

    scope.hide();

    expect(afterHook).toHaveBeenCalledTimes(1);
    expect(afterResource).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);

    error.mockRestore();
  });
});
