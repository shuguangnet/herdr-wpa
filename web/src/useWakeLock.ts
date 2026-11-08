import { useEffect } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };

type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };

function wakeLockApi(): WakeLockLike | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
}

/**
 * Keeps the phone screen awake while the app is visible. Android Chrome and
 * Capacitor support the Screen Wake Lock API; iOS Safari does not, so the call
 * is skipped there. The lock is released when the page hides and re-requested
 * when it becomes visible again.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }
    const api = wakeLockApi();
    if (!api) {
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    const request = async () => {
      if (released || document.visibilityState !== "visible") {
        return;
      }
      try {
        sentinel = await api.request("screen");
      } catch {
        // Rejected by policy or power saving; a terminal without a wake lock
        // must still work.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void request();
      }
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const current = sentinel;
      sentinel = null;
      void current?.release().catch(() => undefined);
    };
  }, [enabled]);
}
