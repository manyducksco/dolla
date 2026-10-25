import { afterEach, describe, expect, test, vi } from "vitest";
import { setErrorHandler, type SignalError } from "../errors.js";
import { flushPendingUpdates, scheduleUpdate, setUpdateStats } from "./scheduler.js";

describe("scheduler", () => {
  test("schedules and flushes updates in order", async () => {
    const order: number[] = [];
    scheduleUpdate(() => order.push(1));
    scheduleUpdate(() => order.push(2));
    scheduleUpdate(() => order.push(3));
    flushPendingUpdates();
    expect(order).toEqual([1, 2, 3]);
  });

  test("recovers from a throwing update", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const order: number[] = [];

    scheduleUpdate(() => {
      throw new Error("boom");
    });
    scheduleUpdate(() => order.push(1));
    scheduleUpdate(() => order.push(2));
    scheduleUpdate(() => {
      throw new Error("boom again");
    });
    scheduleUpdate(() => order.push(3));

    flushPendingUpdates();

    expect(order).toEqual([1, 2, 3]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();

    // Critically: subsequent flushes still work after a throw.
    scheduleUpdate(() => order.push(4));
    scheduleUpdate(() => order.push(5));
    flushPendingUpdates();
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  test("processes updates scheduled during a flush", async () => {
    const order: number[] = [];
    scheduleUpdate(() => {
      order.push(1);
      scheduleUpdate(() => order.push(2));
    });
    scheduleUpdate(() => order.push(3));
    flushPendingUpdates();
    expect(order).toEqual([1, 3, 2]);
  });

  test("coalesces repeated schedules of the same update", () => {
    const order: number[] = [];
    const update = () => order.push(1);

    scheduleUpdate(update);
    scheduleUpdate(update);
    scheduleUpdate(update);
    flushPendingUpdates();

    expect(order).toEqual([1]);
  });

  test("reports a label breakdown for slow flushes", () => {
    setUpdateStats(true);
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(20);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleUpdate(() => {}, { label: "A" });
    scheduleUpdate(() => {}, { label: "B" });
    scheduleUpdate(() => {}, { label: "A" });
    flushPendingUpdates();

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain("3 update(s)");
    expect(message).toContain("A: 2");
    expect(message).toContain("B: 1");

    now.mockRestore();
    warn.mockRestore();
  });

  test("does not time or label flushes when stats are disabled", () => {
    const now = vi.spyOn(performance, "now");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleUpdate(() => {}, { label: "A" });
    flushPendingUpdates();

    expect(now).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();

    now.mockRestore();
    warn.mockRestore();
  });

  test("does not flush when nothing is scheduled", () => {
    // No throw, no work; just confirms the early-return path is safe.
    expect(() => flushPendingUpdates()).not.toThrow();
  });

  test("does not re-queue a microtask after a flush", async () => {
    const order: number[] = [];
    scheduleUpdate(() => order.push(1));
    flushPendingUpdates();
    expect(order).toEqual([1]);

    // A second scheduleUpdate should still work after the first flush.
    scheduleUpdate(() => order.push(2));
    await Promise.resolve();
    flushPendingUpdates();
    expect(order).toEqual([1, 2]);
  });

  test("does not get stuck when an update throws and a recovery happens", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const order: number[] = [];

    scheduleUpdate(() => order.push(1));
    scheduleUpdate(() => {
      throw new Error("boom");
    });
    // The throwing update triggers another scheduleUpdate. The scheduler
    // must recover and process the new update, not get stuck.
    scheduleUpdate(() => order.push(2));
    scheduleUpdate(() => {
      scheduleUpdate(() => order.push(3));
    });

    flushPendingUpdates();

    expect(order).toEqual([1, 2, 3]);
    errorSpy.mockRestore();
  });

  test("reports update errors with their label and continues", () => {
    const errors: SignalError[] = [];
    setErrorHandler((error) => errors.push(error));
    const order: number[] = [];

    scheduleUpdate(
      () => {
        throw new Error("labeled boom");
      },
      { label: "RepeatNode" },
    );
    scheduleUpdate(() => order.push(1));

    flushPendingUpdates();

    expect(order).toEqual([1]);
    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe("update");
    expect(errors[0].label).toBe("RepeatNode");
    expect(errors[0].message).toContain('update "RepeatNode"');

    setErrorHandler(null);
  });

  afterEach(() => {
    setErrorHandler(null);
    setUpdateStats(false);
    vi.restoreAllMocks();
  });
});
