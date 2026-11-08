type Props = {
  visible: boolean;
  onApply: () => void;
  onDismiss: () => void;
};

/** Non-blocking update prompt; typing in the terminal is never interrupted. */
export function PwaUpdateBar({ visible, onApply, onDismiss }: Props) {
  if (!visible) {
    return null;
  }
  return (
    <div className="pwa-update-bar" role="status" aria-live="polite">
      <span className="pwa-update-title">New version available</span>
      <span className="pwa-update-hint">Reload when you are between commands.</span>
      <button type="button" className="term-key" onClick={onDismiss}>
        Later
      </button>
      <button type="button" className="term-key pwa-update-apply" onClick={onApply}>
        Update
      </button>
    </div>
  );
}
