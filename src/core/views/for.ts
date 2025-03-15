import { markup } from "../markup";
import { ViewContext, ViewResult } from "../nodes/view";
import { compose, get, MaybeReactive, Reactive } from "../signals";

interface ForProps<T> {
  each: MaybeReactive<Iterable<T>>;
  key: (item: T, index: number) => any;
  children: (item: Reactive<T>, index: Reactive<number>, ctx: ViewContext) => ViewResult;
}

export function For<T = any>({ each, key, children }: ForProps<T>) {
  return markup("$list", { items: compose(() => Array.from(get(each))), keyFn: key, renderFn: children });
}
