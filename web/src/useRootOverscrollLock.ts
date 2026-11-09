import { useEffect } from "react";

// Reference-counted horizontal overscroll lock. Several mounted terminals (and
// a desktop window with a trackpad) must not fight over the same document
// style, and the first one to unmount must not release a lock another still
// needs.
let holders = 0;
let previous = "";

export function useRootOverscrollLock(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (holders === 0) {
      previous = root.style.overscrollBehaviorX;
      root.style.overscrollBehaviorX = "none";
    }
    holders += 1;
    return () => {
      holders = Math.max(0, holders - 1);
      if (holders === 0) {
        root.style.overscrollBehaviorX = previous;
      }
    };
  }, [enabled]);
}
