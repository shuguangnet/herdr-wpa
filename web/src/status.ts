import { useSyncExternalStore } from "react";

export type StatusTone = "info" | "note" | "success" | "warn" | "error";

export type StatusMessage = {
  id: number;
  text: string;
  tone: StatusTone;
};

export const DEFAULT_STATUS_TTL_MS = 2500;

let current: StatusMessage | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * One transient status channel: latest wins, auto-dismisses by tone. Errors
 * stay until dismissed so a failure cannot scroll away unnoticed.
 */
export function setStatus(text: string, tone: StatusTone = "info", ttlMs?: number | null): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  current = { id: nextId, text, tone };
  nextId += 1;
  emit();
  const ttl = ttlMs === undefined ? (tone === "error" ? null : DEFAULT_STATUS_TTL_MS) : ttlMs;
  if (ttl !== null) {
    timer = setTimeout(() => {
      timer = null;
      current = null;
      emit();
    }, ttl);
  }
}

export function clearStatus(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (current === null) {
    return;
  }
  current = null;
  emit();
}

export function getStatus(): StatusMessage | null {
  return current;
}

export function subscribeStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStatus(): StatusMessage | null {
  return useSyncExternalStore(subscribeStatus, getStatus, getStatus);
}

/** Test seam: clear the channel and reset ids. */
export function __resetStatusForTest(): void {
  clearStatus();
  nextId = 1;
}
