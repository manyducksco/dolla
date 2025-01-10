import { m, type Markup, type DOMHandle } from "../markup.js";
import { assertInstanceOf, isString } from "../typeChecking.js";
import { initView, type View } from "../view.js";
import { DefaultCrashPage } from "../views/default-crash-page.js";
import { DefaultView } from "../views/default-view.js";
import { onCrash } from "./logging.js";

export enum Environment {
  development = "development",
  production = "production",
}

export let isMounted = false;

export let rootElement: HTMLElement;
export let rootView: DOMHandle;

let beforeMountCallbacks: Array<() => void | Promise<void>> = [];
let onMountCallbacks: Array<() => void> = [];
let beforeUnmountCallbacks: Array<() => void | Promise<void>> = [];
let onUnmountCallbacks: Array<() => void> = [];

export let _env = Environment.production;

// When an error of "crash" severity is reported,
// the app is disconnected and a crash page is connected.
onCrash(async ({ error, loggerName, uid }) => {
  // Disconnect app and connect the crash page.
  await unmount();

  const instance = initView({
    view: DefaultCrashPage,
    props: {
      message: error.message,
      error,
      loggerName,
      uid,
    },
  });

  instance.connect(rootElement);
});

/**
 * Gets the app's current environment.
 */
export function getEnv(): Environment {
  return _env;
}

/**
 * Sets the app's environment.
 * Environment affects log levels and development environments will include more debugging info in the DOM.
 */
export function setEnv(env: Environment) {
  _env = env;
}

export function isDevEnvironment() {
  return _env === Environment.development;
}

export function isProdEnvironment() {
  return _env === Environment.production;
}

export async function mount(target: string | HTMLElement, view?: View<any>) {
  if (isMounted) {
    throw new Error(`Dolla is already mounted.`);
  }

  if (isString(target)) {
    const match = document.querySelector<HTMLElement>(target);
    assertInstanceOf(HTMLElement, match, `Selector '${target}' did not match any element.`);
    rootElement = match!;
  } else {
    assertInstanceOf(HTMLElement, target, "Expected an HTML element or a selector string. Got type: %t, value: %v");
    rootElement = target;
  }

  let rootViewMarkup: Markup;

  if (view) {
    rootViewMarkup = m(view);
  } else {
    rootViewMarkup = m(DefaultView);
  }

  // First, initialize the root view. The router store needs this to connect the initial route.
  rootView = initView({
    view: rootViewMarkup.type as View<any>,
    props: rootViewMarkup.props,
  });

  // Run beforeMount
  await Promise.all(beforeMountCallbacks.map((callback) => callback()));

  rootView.connect(rootElement);

  // App is now fully mounted.
  isMounted = true;

  // Run onMount
  for (const callback of onMountCallbacks) {
    callback();
  }
}

export async function unmount() {
  if (!isMounted) return;

  // Run beforeUnmount
  await Promise.all(beforeUnmountCallbacks.map((callback) => callback()));

  rootView.disconnect();

  isMounted = false;

  // Run onUnmount
  for (const callback of onUnmountCallbacks) {
    callback();
  }
}

/**
 * Registers a `callback` to run after `Dolla.mount` is called, before the app is mounted. If `callback` returns a Promise,
 * it will be awaited before mounting finishes. Use this to perform initial setup before the app is displayed to the user.
 */
export function beforeMount(callback: () => void | Promise<void>) {
  beforeMountCallbacks.push(callback);
}

/**
 * Registers a `callback` to run after the app is mounted.
 */
export function onMount(callback: () => void) {
  onMountCallbacks.push(callback);
}

/**
 * Registers a `callback` to run after `Dolla.unmount` is called, before the app is unmounted. If `callback` returns a Promise,
 * it will be awaited before unmounting finishes. Use this to perform cleanup.
 */
export function beforeUnmount(callback: () => void | Promise<void>) {
  beforeUnmountCallbacks.push(callback);
}

/**
 * Registers a `callback` to run after the app is unmounted.
 */
export function onUnmount(callback: () => void) {
  onUnmountCallbacks.push(callback);
}
