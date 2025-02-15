// Mid-term migration layer for converting from State to Reactive.
// Reactivish is a type and set of tools that can work with both of them with one API.

import { isReactive, type Reactive } from "./reactive";
import { isState, type StopFunction, type State, CreateStateOptions } from "./state";

export type MaybeReactivish<T> = State<T> | Reactive<T> | T;
export type Reactivish<T> = State<T> | Reactive<T>;
export type ReactivishOptions<T> = {
  equals?: (a: T, b: T) => boolean;
};

export function isReactivish<T>(value: any): value is Reactivish<T> {
  return isReactive(value) || isState(value);
}

export function watch<T>(thing: Reactivish<T>, callback: (value: T) => void): StopFunction {
  if (isReactive(thing)) {
    return thing.subscribe(callback);
  } else if (isState(thing)) {
    return thing.watch(callback);
  } else {
    throw new TypeError(`Expected a Reactive or State.`);
  }
}
