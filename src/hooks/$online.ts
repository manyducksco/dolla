import { $setup, $watch, state } from "../core";
import { $active } from "./$active";

/**
 * Reliable online connectivity check using a periodic ping to a given URL.
 */
export function $online(pingUrl: string) {
  const isOnline = state(navigator.onLine);
  const isActive = $active();

  let timer: ReturnType<typeof setInterval> | null = null;

  const check = async () => {
    try {
      const resp = await fetch(pingUrl, { method: "HEAD", cache: "no-store" });
      isOnline.set(resp.ok);
    } catch {
      isOnline.set(false);
    }
  };

  const startHeartbeat = () => {
    if (timer) clearInterval(timer);

    // Determine interval: 5s if active/focused, 60s if backgrounded
    const interval = isActive.get() ? 5000 : 60000;

    // Slightly randomize timer to avoid many users hitting the server at the same time.
    const jitter = Math.random() * 1000;
    timer = setInterval(check, interval + jitter);
  };

  $setup(() => {
    // 1. Immediate check and start
    check();
    startHeartbeat();

    // 2. Watch for "Active" changes to pivot the heartbeat speed
    $watch(() => {
      isActive.track(); // Re-run this watch when tab focus changes
      startHeartbeat();
    });

    // 3. Browser hints
    const handleHint = () => {
      if (!navigator.onLine) isOnline.set(false);
      else check();
    };

    window.addEventListener("online", handleHint);
    window.addEventListener("offline", handleHint);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener("online", handleHint);
      window.removeEventListener("offline", handleHint);
    };
  });

  return isOnline;
}
