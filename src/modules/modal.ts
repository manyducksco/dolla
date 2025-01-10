import { type DOMHandle } from "../markup.js";
import { createSignal, StopFunction, watch, type Signal } from "../signals.js";
import { initView, type View } from "../view.js";
import { onMount, onUnmount } from "./core.js";
import { createLogger } from "./logging.js";

import * as render from "./render.js";

const debug = createLogger("dolla/modal");

export interface ModalProps {
  modal: {
    /**
     * Whether the modal is currently open.
     */
    $isOpen: Signal<boolean>;

    /**
     * Call to close the modal from within.
     */
    close: () => void;

    /**
     * Calls `callback` immediately after dialog has been connected.
     */
    transitionIn: (callback: () => Promise<void>) => void;

    /**
     * Calls `callback` and awaits its Promise before disconnecting the dialog.
     */
    transitionOut: (callback: () => Promise<void>) => void;
  };
}

export interface OpenModal {
  instance: DOMHandle;
  transitionInCallback?: () => Promise<void>;
  transitionOutCallback?: () => Promise<void>;
}

const container = document.createElement("div");
container.style.position = "fixed";
container.style.top = "0";
container.style.right = "0";
container.style.bottom = "0";
container.style.left = "0";
container.style.zIndex = "99999";

/**
 * A first-in-last-out queue of modals. The last one appears on top.
 * This way if a modal opens another modal the new modal stacks.
 */
const [$modals, setModals] = createSignal<OpenModal[]>([]);

let activeModals: OpenModal[] = [];

function modalChangedCallback() {
  // Container is only connected to the DOM when there is at least one modal to display.
  if (activeModals.length > 0) {
    if (!container.parentNode) {
      document.body.appendChild(container);
    }
  } else {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  }
}

let stopCallback: StopFunction | undefined;

onMount(() => {
  // Diff modals when value is updated, adding and removing modals as necessary.
  stopCallback = watch([$modals], (modals) => {
    render.update(() => {
      let removed: OpenModal[] = [];
      let added: OpenModal[] = [];

      for (const modal of activeModals) {
        if (!modals.includes(modal)) {
          removed.push(modal);
        }
      }

      for (const modal of modals) {
        if (!activeModals.includes(modal)) {
          added.push(modal);
        }
      }

      for (const modal of removed) {
        if (modal.transitionOutCallback) {
          modal.transitionOutCallback().then(() => {
            modal.instance.disconnect();
            activeModals.splice(activeModals.indexOf(modal), 1);
            modalChangedCallback();
          });
        } else {
          modal.instance.disconnect();
          activeModals.splice(activeModals.indexOf(modal), 1);
        }
      }

      for (const modal of added) {
        modal.instance.connect(container);

        if (modal.transitionInCallback) {
          modal.transitionInCallback();
        }

        activeModals.push(modal);
      }

      modalChangedCallback();
    });
  });
});

onUnmount(() => {
  if (stopCallback) {
    stopCallback();
    stopCallback = undefined;
  }

  if (container.parentNode) {
    document.body.removeChild(container);
  }
});

export function showModal<P extends ModalProps>(view: View<P>, props?: Omit<P, keyof ModalProps>) {
  const [$isOpen, setIsOpen] = createSignal(true);

  let modal: OpenModal | undefined;

  let transitionInCallback: (() => Promise<void>) | undefined;
  let transitionOutCallback: (() => Promise<void>) | undefined;

  let instance = initView({
    view: view as View<unknown>,
    props: {
      ...props,
      modal: {
        $isOpen,
        close: () => {
          setIsOpen(false);
        },
        transitionIn: (callback) => {
          transitionInCallback = callback;
        },
        transitionOut: (callback) => {
          transitionOutCallback = callback;
        },
      },
    } as P,
  });

  modal = {
    instance,

    // These must be getters because the fns passed to props aren't called until before connect.
    get transitionInCallback() {
      return transitionInCallback;
    },
    get transitionOutCallback() {
      return transitionOutCallback;
    },
  };

  setModals((current) => {
    return [...current, modal!];
  });

  const stopObserver = $isOpen.watch((value) => {
    if (!value) {
      closeDialog();
    }
  });

  function closeDialog() {
    setModals((current) => {
      return current.filter((x) => x !== modal);
    });
    modal = undefined;

    stopObserver();
  }

  return closeDialog;
}
