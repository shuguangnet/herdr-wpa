import { connectionPhaseCopy, type ConnectionPhase } from "./connectionPhase";

type Props = {
  phase: ConnectionPhase;
  retrying: boolean;
  onRetry: () => void;
};

/**
 * The phone status bar. It only appears when something is not attached, and it
 * names the failing layer (phone, bridge or Herdr) instead of a generic
 * "disconnected".
 */
export function ConnectionStatusBar({ phase, retrying, onRetry }: Props) {
  if (phase === "terminal-attached") {
    return null;
  }
  const copy = connectionPhaseCopy(phase);
  return (
    <div
      className="connection-status-bar"
      data-phase={phase}
      role="status"
      aria-live="polite"
    >
      <span className="connection-status-title">{copy.title}</span>
      {copy.hint ? <span className="connection-status-hint">{copy.hint}</span> : null}
      {copy.canRetry ? (
        <button
          type="button"
          className="term-key connection-status-retry"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      ) : null}
    </div>
  );
}
