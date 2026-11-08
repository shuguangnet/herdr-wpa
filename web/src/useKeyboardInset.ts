import { useEffect, useState } from "react";

export const KEYBOARD_INSET_VAR = "--keyboard-inset";
export const KEYBOARD_STABLE_DELAY_MS = 80;

export type KeyboardInsetInput = {
  innerHeight: number;
  viewportHeight: number;
  viewportOffsetTop: number;
};

/**
 * How much of the layout viewport the soft keyboard covers. Browsers with
 * `interactive-widget=resizes-content` shrink `innerHeight` with the viewport,
 * so this stays 0 there; iOS Safari keeps `innerHeight` and shrinks only the
 * visual viewport, so this is the amount the dock must move up.
 */
export function keyboardInsetFor({
  innerHeight,
  viewportHeight,
  viewportOffsetTop,
}: KeyboardInsetInput): number {
  const inset = innerHeight - viewportHeight - viewportOffsetTop;
  return Number.isFinite(inset) ? Math.max(0, Math.round(inset)) : 0;
}

/**
 * Publishes the keyboard inset as a CSS variable so the dock, the terminal and
 * overlays share one offset. Changes are coalesced per frame and again after a
 * short settle, because iOS reports several heights during the keyboard slide.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame: number | null = null;
    let settleTimer: number | null = null;
    let latest = 0;

    const apply = () => {
      root.style.setProperty(KEYBOARD_INSET_VAR, `${latest}px`);
      setInset(latest);
    };

    const measure = () => {
      latest = viewport
        ? keyboardInsetFor({
            innerHeight: window.innerHeight,
            viewportHeight: viewport.height,
            viewportOffsetTop: viewport.offsetTop,
          })
        : 0;
      if (frame === null) {
        frame = window.requestAnimationFrame(() => {
          frame = null;
          apply();
        });
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        apply();
      }, KEYBOARD_STABLE_DELAY_MS);
    };

    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", measure);
    measure();

    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.removeEventListener("focusin", measure);
      document.removeEventListener("focusout", measure);
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
      }
      root.style.removeProperty(KEYBOARD_INSET_VAR);
    };
  }, []);

  return inset;
}
