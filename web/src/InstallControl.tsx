import { useInstallOffer } from "./useInstallOffer";

/**
 * The PWA install row. It only offers a button when the browser actually holds
 * an install prompt; iOS gets the share-sheet steps instead, and an installed
 * app renders nothing.
 */
export function InstallControl() {
  const { canInstall, installed, iosHint, install } = useInstallOffer();
  if (installed) {
    return null;
  }
  return (
    <div className="settings-row">
      <span>Install app</span>
      {canInstall ? (
        <button type="button" className="btn" onClick={() => void install()}>
          Install
        </button>
      ) : (
        <span className="settings-note">
          {iosHint ? "Share → Add to Home Screen" : "Open this page in Chrome or Safari"}
        </span>
      )}
    </div>
  );
}
