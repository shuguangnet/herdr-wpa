import { useSyncExternalStore } from "react";

let count = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Marks one in-flight write. Returns an idempotent `done` so a failure path can
 * release it without double-counting. Concurrent writes nest.
 */
export function trackBusy(): () => void {
  count += 1;
  emit();
  let done = false;
  return () => {
    if (done) {
      return;
    }
    done = true;
    count = Math.max(0, count - 1);
    emit();
  };
}

export function getBusy(): boolean {
  return count > 0;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBusy(): boolean {
  return useSyncExternalStore(subscribe, getBusy, getBusy);
}

/** Test seam. */
export function __resetBusyForTest(): void {
  count = 0;
  emit();
}
