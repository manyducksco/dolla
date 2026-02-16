import type { Env } from "../types";

// Get env from environment variable if possible, otherwise default to production.
let currentEnv =
  (typeof process !== "undefined" && process.env && process.env.NODE_ENV) ??
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  "production";

export function getEnv() {
  return currentEnv;
}

export function setEnv(value: Env) {
  currentEnv = value;
}
