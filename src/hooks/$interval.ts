import { $setup } from "../core";

export function $interval(ms: number, callback: () => any) {
  $setup(() => {
    const interval = setInterval(callback, ms);
    return () => clearInterval(interval);
  });
}
