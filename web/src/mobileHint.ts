export const MOBILE_HINT_STORAGE_KEY = "herdr.mobileWeb.mobileHint.v1";

export function shouldShowMobileHint(isTouch: boolean, stored: string | null): boolean {
  return isTouch && stored !== "1";
}

export function readMobileHintSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(MOBILE_HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMobileHintSeen(): void {
  try {
    globalThis.localStorage?.setItem(MOBILE_HINT_STORAGE_KEY, "1");
  } catch {
    // Private mode: the hint reappears next session, which is harmless.
  }
}
