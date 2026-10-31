import { afterEach, describe, expect, test, vi } from "vitest";
import { sleep } from "../utils";
import { debounce } from "./debounce";
import { createContext, mountContext, cleanupContext } from "./context";

const WAIT_MS = 1;

describe("with function", () => {
  test("basics", async () => {
    let value = 0;

    const update = vi.fn((next: number) => {
      value = next;
    });
    const debouncer = debounce(WAIT_MS, update);

    debouncer.call(1);
    expect(value).toBe(0);

    await sleep(WAIT_MS + 1);
    expect(value).toBe(1);

    debouncer.call(5);
    debouncer.call(7);
    debouncer.call(2);

    expect(value).toBe(1);

    await sleep(WAIT_MS + 1);
    expect(value).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(2);
  });

  test("flush", async () => {
    let value = 0;

    const increment = debounce(WAIT_MS, () => {
      value++;
    });

    increment.call();
    expect(value).toBe(0);

    increment.flush();
    expect(value).toBe(1); // applied immediately

    await sleep(WAIT_MS + 1);
    expect(value).toBe(1); // doesn't run after time elapses
  });

  test("cancel", async () => {
    let value = 0;

    const increment = debounce(WAIT_MS, () => {
      value++;
    });

    increment.call();
    expect(value).toBe(0);

    increment.cancel();
    expect(value).toBe(0);

    await sleep(WAIT_MS + 1);
    expect(value).toBe(0); // doesn't run after time elapses
  });
});

describe("freeform", () => {
  test("basics", async () => {
    let value = 0;

    const debouncer = debounce(WAIT_MS);

    const update = vi.fn((next: number) => {
      value = next;
    });
    debouncer.call(() => update(1));

    expect(value).toBe(0);

    await sleep(WAIT_MS + 1);
    expect(value).toBe(1);

    debouncer.call(() => update(5));
    debouncer.call(() => update(7));
    debouncer.call(() => update(2));

    expect(value).toBe(1);

    await sleep(WAIT_MS + 1);
    expect(value).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(2);
  });

  test("flush", async () => {
    let value = 0;

    const update = () => {
      value++;
    };
    const increment = debounce(WAIT_MS);

    increment.call(update);
    expect(value).toBe(0);

    increment.flush();
    expect(value).toBe(1); // applied immediately

    await sleep(WAIT_MS + 1);
    expect(value).toBe(1); // doesn't run after time elapses
  });

  test("cancel", async () => {
    let value = 0;

    const update = () => {
      value++;
    };
    const increment = debounce(WAIT_MS);

    increment.call(update);
    expect(value).toBe(0);

    increment.cancel();
    expect(value).toBe(0);

    await sleep(WAIT_MS + 1);
    expect(value).toBe(0); // doesn't run after time elapses
  });
});

test("signal cancellation", async () => {
  const abortController = new AbortController();

  let value = 0;

  const update = () => {
    value++;
  };
  const increment = debounce(WAIT_MS, { signal: abortController.signal });

  increment.call(update);
  expect(value).toBe(0);

  abortController.abort();
  expect(value).toBe(0);

  await sleep(WAIT_MS + 1);
  expect(value).toBe(0); // doesn't run after time elapses
});

test("context cleanup cancellation", async () => {
  const context = createContext(null);
  mountContext(context);

  let value = 0;

  const update = () => {
    value++;
  };
  const increment = debounce(WAIT_MS, { context });

  increment.call(update);
  expect(value).toBe(0);

  cleanupContext(context);
  expect(value).toBe(0);

  await sleep(WAIT_MS + 1);
  expect(value).toBe(0); // doesn't run after time elapses
});

describe("re-entrant and failing calls", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("cancel stops a call scheduled from inside the debounced function", () => {
    vi.useFakeTimers();
    const d = debounce(WAIT_MS);
    let runs = 0;
    const poll = () => {
      runs++;
      d.call(poll);
    };
    d.call(poll);
    vi.advanceTimersByTime(WAIT_MS);
    expect(runs).toBe(1);

    d.cancel();
    vi.advanceTimersByTime(WAIT_MS * 5);
    expect(runs).toBe(1);
  });

  test("context cleanup stops a polling loop", () => {
    vi.useFakeTimers();
    const context = createContext(null);
    mountContext(context);
    let runs = 0;
    const d = debounce(WAIT_MS, () => {
      runs++;
      d.call();
    }, { context });
    d.call();
    vi.advanceTimersByTime(WAIT_MS * 3);
    expect(runs).toBe(3);

    cleanupContext(context);
    vi.advanceTimersByTime(WAIT_MS * 5);
    expect(runs).toBe(3);
  });

  test("flush does not re-run a function that threw from the timer", () => {
    vi.useFakeTimers();
    const d = debounce(WAIT_MS);
    const fn = vi.fn(() => {
      throw new Error("boom");
    });
    d.call(fn);
    expect(() => vi.advanceTimersByTime(WAIT_MS)).toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);

    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
