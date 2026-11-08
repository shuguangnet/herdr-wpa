import { useSyncExternalStore } from "react";

export const HAPTICS_STORAGE_KEY = "herdr.mobileWeb.haptics.v1";
export const DEFAULT_HAPTICS_ENABLED = true;

export function parseHapticsEnabled(value: unknown): boolean {
  return typeof value === "boolean" ? value : DEFAULT_HAPTICS_ENABLED;
}

/** Pure decision so the platform gates can be tested without a browser. */
export function shouldPulse({
  enabled,
  supported,
  reduceMotion,
}: {
  enabled: boolean;
  supported: boolean;
  reduceMotion: boolean;
}): boolean {
  return enabled && supported && !reduceMotion;
}

function reduceMotionNow(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
}

function vibrationSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function readStored(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(HAPTICS_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_HAPTICS_ENABLED;
    }
    return parseHapticsEnabled(JSON.parse(raw));
  } catch {
    return DEFAULT_HAPTICS_ENABLED;
  }
}

let enabled = readStored();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getHapticsEnabled(): boolean {
  return enabled;
}

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
  try {
    globalThis.localStorage?.setItem(HAPTICS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the in-memory value still applies.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stored preference, shared by the key board and the settings dialog. */
export function useHapticsEnabled(): boolean {
  return useSyncExternalStore(subscribe, getHapticsEnabled, getHapticsEnabled);
}

/**
 * Pulses once if the device can vibrate, the user opted in and reduced-motion
 * is off. Android Chrome/Capacitor support `navigator.vibrate`; iOS Safari does
 * not, so the call is silently skipped there.
 */
export function pulseHaptics(durationMs = 10): void {
  if (
    !shouldPulse({
      enabled,
      supported: vibrationSupported(),
      reduceMotion: reduceMotionNow(),
    })
  ) {
    return;
  }
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Vibration can be rejected by policy; a key press must still send.
  }
}

/** Test seam: re-read storage the way a fresh page load would. */
export function __reloadHaptics(): void {
  enabled = readStored();
  emit();
}
