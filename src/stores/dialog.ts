import { type DOMHandle } from "../markup.js";
import { observe, writable, type Writable } from "../state.js";
import { getStoreSecrets, type StoreContext } from "../store.js";
import { initView, type View } from "../view.js";

export interface DialogProps {
  /**
   * Whether the dialog is currently open.
   */
  $$open: Writable<boolean>;

  /**
   * Calls `callback` immediately after dialog has been connected.
   */
  transitionIn: (callback: () => Promise<void>) => void;

  /**
   * Calls `callback` and awaits its Promise before disconnecting the dialog.
   */
  transitionOut: (callback: () => Promise<void>) => void;
}

export interface OpenDialog {
  instance: DOMHandle;
  transitionInCallback?: () => Promise<void>;
  transitionOutCallback?: () => Promise<void>;
}

/**
 * Manages dialogs. Also known as modals.
 * TODO: Describe this better.
 */
export function DialogStore(ctx: StoreContext) {
  ctx.name = "dolla/dialog";

  const { appContext, elementContext } = getStoreSecrets(ctx);

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.right = "0";
  container.style.bottom = "0";
  container.style.left = "0";
  container.style.zIndex = "99999";

  /**
   * A first-in-last-out queue of dialogs. The last one appears on top.
   * This way if a dialog opens another dialog the new dialog stacks.
   */
  const $$dialogs = writable<OpenDialog[]>([]);

  let activeDialogs: OpenDialog[] = [];

  function dialogChangedCallback() {
    // Container is only connected to the DOM when there is at least one dialog to display.
    if (activeDialogs.length > 0) {
      if (!container.parentNode) {
        document.body.appendChild(container);
      }
    } else {
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  }

  // Diff dialogs when value is updated, adding and removing dialogs as necessary.
  ctx.observe($$dialogs, (dialogs) => {
    requestAnimationFrame(() => {
      let removed: OpenDialog[] = [];
      let added: OpenDialog[] = [];

      for (const dialog of activeDialogs) {
        if (!dialogs.includes(dialog)) {
          removed.push(dialog);
        }
      }

      for (const dialog of dialogs) {
        if (!activeDialogs.includes(dialog)) {
          added.push(dialog);
        }
      }

      for (const dialog of removed) {
        if (dialog.transitionOutCallback) {
          dialog.transitionOutCallback().then(() => {
            dialog.instance.disconnect();
            activeDialogs.splice(activeDialogs.indexOf(dialog), 1);
            dialogChangedCallback();
          });
        } else {
          dialog.instance.disconnect();
          activeDialogs.splice(activeDialogs.indexOf(dialog), 1);
        }
      }

      for (const dialog of added) {
        dialog.instance.connect(container);

        if (dialog.transitionInCallback) {
          dialog.transitionInCallback();
        }

        activeDialogs.push(dialog);
      }

      dialogChangedCallback();
    });
  });

  ctx.onDisconnected(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  function open<P extends DialogProps>(view: View<P>, props?: Omit<P, keyof DialogProps>) {
    const $$open = writable(true);

    let dialog: OpenDialog | undefined;

    let transitionInCallback: (() => Promise<void>) | undefined;
    let transitionOutCallback: (() => Promise<void>) | undefined;

    let instance = initView({
      view: view as View<unknown>,
      appContext,
      elementContext,
      props: {
        ...props,
        $$open,
        transitionIn: (callback) => {
          transitionInCallback = callback;
        },
        transitionOut: (callback) => {
          transitionOutCallback = callback;
        },
      } as P,
    });

    dialog = {
      instance,

      // These must be getters because the fns passed to props aren't called until before connect.
      get transitionInCallback() {
        return transitionInCallback;
      },
      get transitionOutCallback() {
        return transitionOutCallback;
      },
    };

    $$dialogs.update((current) => {
      return [...current, dialog!];
    });

    const stopObserver = observe($$open, (value) => {
      if (!value) {
        closeDialog();
      }
    });

    function closeDialog() {
      $$dialogs.update((current) => {
        return current.filter((x) => x !== dialog);
      });
      dialog = undefined;

      stopObserver();
    }

    return closeDialog;
  }

  return {
    open,
  };
}
