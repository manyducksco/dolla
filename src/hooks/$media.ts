import { $setup, Reactive, state } from "../core";

export function $media(query: string): Reactive<boolean> {
  const list = window.matchMedia(query);
  const match = state(list.matches);

  const onChange = () => {
    match.set(list.matches);
  };

  $setup(() => {
    list.addEventListener("change", onChange);

    return () => {
      list.removeEventListener("change", onChange);
    };
  });

  return match;
}
