import type { View } from "../types";
import { Context } from "./context.js";
import { createI18n, I18N, type I18nOptions } from "./i18n.js";
import { ViewNode } from "./nodes/view.js";
import { CrashViewProps, DefaultCrashView } from "./views/default-crash-view.js";

/**
 * Represents the Dolla app's parent element in context state.
 */
export const PARENT_ELEMENT = Symbol("parentElement");

export interface DollaOptions {
  /**
   * Main view to mount in the app. Used unless `routes` is defined.
   */
  view: View<{}>;

  /**
   * View to show when a $debug crash is invoked. Takes information about the crash.
   */
  crashView?: View<CrashViewProps>;

  /**
   * Options for language translations.
   */
  i18n?: I18nOptions;
}

export interface DollaApp {}

export function createApp(view: View<{}>, options?: DollaOptions) {
  const context = new Context("dolla:app");
  const crashView = options?.crashView ?? DefaultCrashView;
  const cleanup: (() => void)[] = [];
  const root = new ViewNode(context, view, {});

  const i18n = createI18n({
    locale: options?.i18n?.locale ?? "auto",
    translations: options?.i18n?.translations ?? [],
    ...options?.i18n,
  });
  context.setState(I18N, i18n.exports);

  async function mount(parent: string | Element): Promise<void> {
    if (context.isMounted()) return;

    const element = getElement(parent);

    context.setState(PARENT_ELEMENT, element);

    cleanup.push(
      context.catchError((error, info) => {
        unmount().then(() => {
          new ViewNode(context, crashView, { error, info }).mount(element);
        });
      }),
    );

    context.emit("willMount");

    await i18n.handle.mount();
    root.mount(element);

    context.emit("didMount");
  }

  async function unmount(): Promise<void> {
    if (!context.isMounted()) return;

    context.emit("willUnmount");

    root.unmount(false);
    i18n.handle.unmount();

    for (const callback of cleanup) {
      callback();
    }
    cleanup.length = 0;

    context.emit("didUnmount");
  }

  return { mount, unmount, setLocale: i18n.exports.setLocale };
}

function getElement(element: string | Element): Element {
  if (typeof element === "string") {
    const match = document.querySelector(element);
    if (!match) {
      throw new Error(`Selector '${element}' did not many any element.`);
    }
    return match;
  } else if (element instanceof Element) {
    return element;
  } else {
    throw new Error("Expected a selector string or DOM element.");
  }
}
