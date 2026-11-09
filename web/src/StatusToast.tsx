import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import type { StatusMessage, StatusTone } from "./status";

const ICONS = {
  info: Info,
  note: Info,
  success: CheckCircle2,
  warn: TriangleAlert,
  error: AlertCircle,
} as const satisfies Record<StatusTone, typeof Info>;

type Props = {
  status: StatusMessage;
  onDismiss: () => void;
};

/**
 * The app's one transient status surface. It floats over the top of the stage
 * instead of taking a layout row, so it never pushes the terminal or the dock.
 */
export function StatusToast({ status, onDismiss }: Props) {
  const Icon = ICONS[status.tone];
  return (
    <div className="stage-toast" data-tone={status.tone} role="status" aria-live="polite">
      <Icon size={15} aria-hidden="true" />
      <span className="stage-toast-text">{status.text}</span>
      <button
        type="button"
        className="stage-toast-dismiss"
        aria-label="Dismiss status"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}
