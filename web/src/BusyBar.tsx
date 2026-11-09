import { useEffect, useState } from "react";

import { useBusy } from "./busy";

/**
 * A thin ambient progress bar for in-flight writes. Delayed so a fast action
 * never paints it; aria-hidden because each action reports its own outcome.
 */
export function BusyBar({ delayMs = 200 }: { delayMs?: number }) {
  const busy = useBusy();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [busy, delayMs]);

  if (!visible) {
    return null;
  }
  return (
    <div className="busy-bar" aria-hidden="true">
      <span className="busy-bar-indicator" />
    </div>
  );
}
