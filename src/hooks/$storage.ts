import { $setup, $effect, state, type Mutable } from "../core";

const bus = new EventTarget();

export interface StorageHookOptions {
  type: "local" | "session";
}

export function $storage<T>(key: string, defaultValue: T, options?: StorageHookOptions): Mutable<T>;
export function $storage<T>(key: string, defaultValue?: T, options?: StorageHookOptions): Mutable<T | undefined>;

export function $storage<T>(key: string, defaultValue?: T, options?: StorageHookOptions): Mutable<T> {
  const storage: Storage = options?.type === "session" ? sessionStorage : localStorage;

  const saved = storage.getItem(key);
  const initial = saved !== null ? JSON.parse(saved) : defaultValue;
  const value = state(initial);

  let isLocalUpdate = false;

  $effect(() => {
    const next = value.track();
    storage.setItem(key, JSON.stringify(next));

    // Notify other $storage instances on the same page.
    isLocalUpdate = true;
    bus.dispatchEvent(new CustomEvent(key, { detail: next }));
  });

  // Listen for storage events to keep in sync with other tabs and other $storage instances on this page with the same key.
  $setup(() => {
    // Handles 'storage' events fired from other tabs.
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        value.set(JSON.parse(event.newValue));
      }
    };

    // Handles bus events from other instances of this key on the same page.
    const handleBus = (event: CustomEvent<T>) => {
      if (isLocalUpdate) {
        isLocalUpdate = false;
        return;
      }

      // Otherwise update our local signal.
      if (event.detail !== null) {
        value.set(event.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    bus.addEventListener(key, handleBus as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      bus.removeEventListener(key, handleBus as EventListener);
    };
  });

  return value;
}
