import type { Env } from "../types";

let currentEnv = "production";

export function getEnv() {
  return currentEnv;
}

export function setEnv(value: Env) {
  currentEnv = value;
}
