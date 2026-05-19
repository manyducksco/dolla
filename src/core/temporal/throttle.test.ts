import { expect, test, vi } from "vitest";
import { sleep } from "../../utils";
import { throttle } from "./throttle";

const WAIT_MS = 1;

test("with function", async () => {
  let value = 0;

  const update = vi.fn((next: number) => {
    value = next;
  });
  const throttled = throttle(WAIT_MS, update);

  throttled.call(1);
  throttled.call(2);
  throttled.call(3);
  expect(value).toBe(1);
  expect(update).toHaveBeenCalledTimes(1);

  await sleep(WAIT_MS + 1);
  throttled.call(4);
  throttled.call(5);

  expect(value).toBe(4);
  expect(update).toHaveBeenCalledTimes(2);

  throttled.reset();
  throttled.call(6);
  throttled.call(7);

  expect(value).toBe(6);
  expect(update).toHaveBeenCalledTimes(3);
});

test("freeform", async () => {
  let value = 0;

  const update = vi.fn((next: number) => {
    value = next;
  });
  const throttled = throttle(WAIT_MS);

  throttled.call(() => update(1));
  throttled.call(() => update(2));
  throttled.call(() => update(3));
  expect(value).toBe(1);
  expect(update).toHaveBeenCalledTimes(1);

  await sleep(WAIT_MS + 1);
  throttled.call(() => update(4));
  throttled.call(() => update(5));

  expect(value).toBe(4);
  expect(update).toHaveBeenCalledTimes(2);

  throttled.reset();
  throttled.call(() => update(6));
  throttled.call(() => update(7));

  expect(value).toBe(6);
  expect(update).toHaveBeenCalledTimes(3);
});
