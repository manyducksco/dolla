import { describe, expect, test, vi } from "vitest";
import { flushPendingUpdates, scheduleUpdate } from "./scheduler.js";

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
});
