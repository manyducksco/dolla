import { describe, expect, test, vi } from "vitest";
import { sleep } from "../../utils";
import { debounce } from "./debounce";
import { createContext, mountContext, cleanupContext } from "../context";

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
