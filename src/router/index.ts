import { Context, inject } from "../core";
import { RouterStore } from "./store";

export { createRouter, lazy, RedirectError } from "./router";
export type { RouterOptions } from "./types";

export function useRouter(context: Context) {
  return inject(context, RouterStore);
}
