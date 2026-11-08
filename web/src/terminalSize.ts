export type TerminalSizeMessage = { cols: number; rows: number };

/**
 * The bridge reports the PTY size it actually uses after clamping browser
 * requests to Herdr's existing pane size. The browser renders at least that
 * size so its viewport cannot shrink the shared terminal.
 */
export function parseTerminalSizeMessage(data: unknown): TerminalSizeMessage | null {
  if (typeof data !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(data) as { type?: unknown; cols?: unknown; rows?: unknown };
    if (!parsed || parsed.type !== "terminal_size") {
      return null;
    }
    if (typeof parsed.cols !== "number" || typeof parsed.rows !== "number") {
      return null;
    }
    if (!Number.isFinite(parsed.cols) || !Number.isFinite(parsed.rows)) {
      return null;
    }
    const cols = Math.floor(parsed.cols);
    const rows = Math.floor(parsed.rows);
    if (cols <= 0 || rows <= 0) {
      return null;
    }
    return { cols, rows };
  } catch {
    return null;
  }
}
