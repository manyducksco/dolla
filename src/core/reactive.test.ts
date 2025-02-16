// import { inspect } from "node:util";
import { test, expect, vi } from "vitest";
import { atom, compose } from "./reactive";

test("solves diamond problem", () => {
  const count = atom(1, { label: "count" });

  const left = compose((get) => get(count) + 5, { label: "left" });
  const right = compose((get) => get(count) / 2, { label: "right" });

  const sum = compose((get) => get(left) + get(right), { label: "sum" });

  const fn = vi.fn();
  const unsubscribe = sum.subscribe(fn);

  expect(fn).toBeCalledTimes(1);

  count.value++;
  count.value++;
  count.value++;

  // Subscribers are not called until next microtask phase.
  queueMicrotask(() => {
    expect(fn).toBeCalledTimes(2);
    unsubscribe();
  });
});

test("throws error if getter is called after function body returns", () => {
  return new Promise<void>((resolve, reject) => {
    const test = compose((get) => {
      setTimeout(() => {
        expect(() => {
          get(true);
        }).toThrowError();

        resolve();
      }, 0);
      return true;
    });

    test.value;
  });

  // expect(() => {
  //   compose((get) => {
  //     setTimeout(() => {
  //       get(true);
  //     });
  //   });
  // }).toThrowError();
});
