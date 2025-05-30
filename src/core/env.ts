export type Env = "production" | "development";

let env: Env = "production";

/**
 * Gets the current environment value.
 */
export function getEnv(): Env {
  return env;
}

/**
 * Sets the environment value. Affects which log messages will print and how much debugging info is included in the DOM.
 */
export function setEnv(value: Env) {
  env = value;
}
