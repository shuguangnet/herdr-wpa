import { useEffect, useRef, useSyncExternalStore } from "react";

export const MOBILE_GESTURES_STORAGE_KEY = "herdr.mobileWeb.gestures.v1";
export const DEFAULT_MOBILE_GESTURES_ENABLED = true;
export const GESTURE_EDGE_PX = 24;
export const GESTURE_DIRECTION_THRESHOLD_PX = 12;
export const GESTURE_SWIPE_RATIO = 0.15;
export const GESTURE_MIN_SWIPE_PX = 48;
export const GESTURE_PULL_REFRESH_PX = 64;
/** After a navigation gesture, ignore the synthetic click the browser emits. */
export const GESTURE_CLICK_SWALLOW_MS = 350;
/** A canvas swipe must finish quickly to count as navigation, not selection. */
export const GESTURE_QUICK_SWIPE_MS = 260;

export type GestureIntent =
  | "pending"
  | "none"
  | "swipe-left"
  | "swipe-right"
  | "back"
  | "pull-refresh";

export function parseMobileGesturesEnabled(value: unknown): boolean {
  return typeof value === "boolean" ? value : DEFAULT_MOBILE_GESTURES_ENABLED;
}

let gesturesEnabled = readStored();
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(MOBILE_GESTURES_STORAGE_KEY);
    if (raw === null || raw === undefined) {
      return DEFAULT_MOBILE_GESTURES_ENABLED;
    }
    return parseMobileGesturesEnabled(JSON.parse(raw));
  } catch {
    return DEFAULT_MOBILE_GESTURES_ENABLED;
  }
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getMobileGesturesEnabled(): boolean {
  return gesturesEnabled;
}

export function setMobileGesturesEnabled(next: boolean): void {
  gesturesEnabled = next;
  try {
    globalThis.localStorage?.setItem(MOBILE_GESTURES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the in-memory value still applies.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMobileGesturesEnabled(): boolean {
  return useSyncExternalStore(subscribe, getMobileGesturesEnabled, getMobileGesturesEnabled);
}

export type GestureInput = {
  dx: number;
  dy: number;
  width: number;
  edgeStart: boolean;
  atTop: boolean;
};

/**
 * Classifies a finished pointer gesture. Horizontal intent wins over vertical
 * once the pointer has travelled past the direction threshold; the edge swipe
 * back is checked before pane/tab switching so it cannot be swallowed by it.
 */
export function resolveGesture({
  dx,
  dy,
  width,
  edgeStart,
  atTop,
}: GestureInput): GestureIntent {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < GESTURE_DIRECTION_THRESHOLD_PX) {
    return "pending";
  }
  if (absX >= absY) {
    if (edgeStart && dx > 0 && dx >= GESTURE_MIN_SWIPE_PX) {
      return "back";
    }
    const threshold = Math.max(GESTURE_MIN_SWIPE_PX, width * GESTURE_SWIPE_RATIO);
    if (dx <= -threshold) {
      return "swipe-left";
    }
    if (dx >= threshold) {
      return "swipe-right";
    }
    return "none";
  }
  if (atTop && dy >= GESTURE_PULL_REFRESH_PX) {
    return "pull-refresh";
  }
  return "none";
}

const EXCLUDED_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  ".term-key",
  ".mobile-key-board",
  ".mobile-key-editor",
  ".overlay-root",
  "[data-gesture-ignore]",
].join(",");

/** Gestures never start on a control, a terminal canvas or an overlay. */
let swallowClickUntil = 0;

/**
 * The terminal canvas normally belongs to text selection. A quick flick is far
 * more likely to mean "next pane" than a deliberate selection drag, so canvas
 * swipes are accepted only inside the quick window.
 */
export function shouldAllowCanvasGesture(fromCanvas: boolean, durationMs: number): boolean {
  return !fromCanvas || durationMs <= GESTURE_QUICK_SWIPE_MS;
}

/** Whether a click landing now belongs to the gesture that just finished. */
export function shouldSwallowClick(now: number, until: number): boolean {
  return now < until;
}

export function isGestureExcludedTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }
  return target.closest(EXCLUDED_SELECTOR) !== null;
}

export type MobileGestureOptions = {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onBack: () => void;
  onRefresh: () => void;
};

type GestureStart = {
  x: number;
  y: number;
  startedAt: number;
  fromCanvas: boolean;
  edgeStart: boolean;
  atTop: boolean;
  axis: "none" | "horizontal" | "vertical";
};

/**
 * Window-level touch gestures for the compact layout. Only coarse pointers are
 * considered, and only when the caller enables them; mouse and pen users keep
 * the desktop behaviour.
 */
export function useMobileGestures(options: MobileGestureOptions): void {
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    if (!options.enabled || typeof window === "undefined") {
      return;
    }
    if (!window.matchMedia?.("(pointer: coarse)").matches) {
      return;
    }
    let start: GestureStart | null = null;

    const reset = () => {
      start = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === "mouse") {
        return;
      }
      if (isGestureExcludedTarget(event.target)) {
        return;
      }
      start = {
        x: event.clientX,
        y: event.clientY,
        startedAt: performance.now(),
        fromCanvas:
          typeof Element !== "undefined" &&
          event.target instanceof Element &&
          event.target.closest("canvas") !== null,
        edgeStart: event.clientX <= GESTURE_EDGE_PX,
        atTop: (window.scrollY ?? 0) <= 0,
        axis: "none",
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start || !event.isPrimary) {
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (start.axis === "none" && Math.max(Math.abs(dx), Math.abs(dy)) >= GESTURE_DIRECTION_THRESHOLD_PX) {
        start.axis = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (start.axis === "horizontal") {
        // Keep the browser from starting a text selection while swiping.
        event.preventDefault();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!start || !event.isPrimary) {
        return;
      }
      const started = start;
      reset();
      const gesture = resolveGesture({
        dx: event.clientX - started.x,
        dy: event.clientY - started.y,
        width: window.innerWidth,
        edgeStart: started.edgeStart,
        atTop: started.atTop,
      });
      if (gesture === "pending" || gesture === "none") {
        return;
      }
      if (
        !shouldAllowCanvasGesture(
          started.fromCanvas,
          performance.now() - started.startedAt,
        )
      ) {
        return;
      }
      if (gesture === "swipe-left" || gesture === "swipe-right" || gesture === "back") {
        // The browser still emits a click at the pointer-up position; without
        // this the gesture would also tap whatever sat there.
        swallowClickUntil = performance.now() + GESTURE_CLICK_SWALLOW_MS;
      }
      if (gesture === "swipe-left") {
        latest.current.onSwipeLeft();
      } else if (gesture === "swipe-right") {
        latest.current.onSwipeRight();
      } else if (gesture === "back") {
        latest.current.onBack();
      } else if (gesture === "pull-refresh") {
        latest.current.onRefresh();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", reset);
    const onClickCapture = (event: MouseEvent) => {
      if (!shouldSwallowClick(performance.now(), swallowClickUntil)) {
        return;
      }
      if (isGestureExcludedTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      swallowClickUntil = 0;
    };
    window.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", reset);
      window.removeEventListener("click", onClickCapture, true);
    };
  }, [options.enabled]);
}

/** Test seam: re-read storage the way a fresh page load would. */
export function __reloadMobileGestures(): void {
  gesturesEnabled = readStored();
  emit();
}
