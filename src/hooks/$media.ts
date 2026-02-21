import { $setup, Readable, state } from "../core";

export function $media(query: string): Readable<boolean> {
  const list = window.matchMedia(query);
  const match = state(list.matches);

  const onChange = () => {
    match.write(list.matches);
  };

  $setup(() => {
    list.addEventListener("change", onChange);

    return () => {
      list.removeEventListener("change", onChange);
    };
  });

  return match;
}
