import "@fontsource-variable/geist/wght.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BridgeProvider } from "./bridge";
import { startNativeControls } from "./native";
import "./styles.css";

startNativeControls();

// Service worker: the app shell can open offline. Registration is a same-origin
// external module (no inline script) and failure is non-fatal on WebViews.
if ("serviceWorker" in navigator) {
  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const update = registerSW({
        immediate: true,
        onNeedRefresh: () => window.dispatchEvent(new Event("herdr:pwa-update")),
      });
      window.addEventListener("herdr:pwa-apply", () => {
        void update(true);
      });
    })
    .catch(() => undefined);
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("missing root element");
}

createRoot(root).render(
  <StrictMode>
    <BridgeProvider>
      <App />
    </BridgeProvider>
  </StrictMode>,
);
