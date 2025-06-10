import { expect, test, vi } from "vitest";
import { $, get, untracked, effect, batch, type Signal } from "./signals";

test("basic composition & tracking", () => {
  const $count = $(5);
  const $doubled = $(() => $count() * 2);

  const $same = $($count); // just so happens to follow the signature of a composer; creates a Signal with the same value
  expect($same()).toBe(5);

  expect($count()).toBe(5);
  expect(get($doubled)).toBe(10);

  const fn = vi.fn(() => {
    $doubled();
  });
  const stop = effect(fn);

  expect(fn).toBeCalledTimes(1);

  // Effects should not run until end of batch.
  batch(() => {
    $count((c) => c + 1);
    $count((c) => c + 1);
    $count((c) => c + 1);
    $count((c) => c + 1);
  });

  expect(fn).toBeCalledTimes(2);
  expect($same()).toBe(9);

  stop();
});

test("signals returned from composer function are unwrapped", () => {
  const $count = $(5);
  const $doubled = $(() => $count);

  expect($doubled()).toBe(5);

  $count((x) => x + 1);

  expect($doubled()).toBe(6);
});

test("untracked callback is not tracked", () => {
  const $a = $(5);
  const $b = $(10);

  const $multiplied = $(() => $a() * untracked($b));

  expect($multiplied()).toBe(50);

  $a((x) => x + 1);

  expect($multiplied()).toBe(60);

  $b((x) => x + 1);

  expect($multiplied()).toBe(60);
});

test("solves diamond problem", () => {
  const $count = $(1);

  const $left = $(() => $count() + 5);
  const $right = $(() => $count() / 2);

  const $sum = $(() => $left() + $right());

  const fn = vi.fn(() => {
    $sum();
  });
  const unsubscribe = effect(fn);

  expect(fn).toBeCalledTimes(1);

  $count((x) => x + 1);
  batch(() => {
    $count((x) => x + 1);
    $count((x) => x + 1);
  });

  expect(fn).toBeCalledTimes(3);
  unsubscribe();
});

test("nested compose", () => {
  const $count = $(0);

  const plus1 = (signal: Signal<number>) => {
    return $(() => signal() + 1);
  };

  const $one = plus1($count);
  const $two = plus1($one);
  const $three = plus1($two);

  const fn = vi.fn(() => {
    $three();
  });
  const stop = effect(fn);

  expect(fn).toBeCalledTimes(1);

  expect($one()).toBe(1);
  expect($two()).toBe(2);
  expect($three()).toBe(3);

  $count((x) => x + 1);

  expect(fn).toBeCalledTimes(2);

  expect($one()).toBe(2);
  expect($two()).toBe(3);
  expect($three()).toBe(4);

  stop();
});

test("effect runs cleanup function", () => {
  const fn = vi.fn();
  const $count = $(0);

  const stop = effect(() => {
    $count();
    return fn;
  });
  expect(fn).toBeCalledTimes(0);

  $count(2);
  expect(fn).toBeCalledTimes(1);

  $count(3);
  expect(fn).toBeCalledTimes(2);

  stop();
});
