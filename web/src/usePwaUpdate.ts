import { useEffect, useState } from "react";

/**
 * Bridges the service worker registration (in `main.tsx`) to React. The
 * registration script lives outside React and outside tests, so this hook only
 * listens for the window events it emits.
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onUpdate = () => setNeedRefresh(true);
    window.addEventListener("herdr:pwa-update", onUpdate);
    return () => window.removeEventListener("herdr:pwa-update", onUpdate);
  }, []);

  return {
    needRefresh,
    applyUpdate: () => {
      setNeedRefresh(false);
      window.dispatchEvent(new Event("herdr:pwa-apply"));
    },
    dismiss: () => setNeedRefresh(false),
  };
}
