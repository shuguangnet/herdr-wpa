/**
 * Terminal scroll positions per terminal id, kept for this browser tab only.
 * Switching panes/tabs unmounts the terminal; without this the next mount
 * starts at the newest output even if the operator was reading scrollback.
 */
const scrollByTerminal = new Map<string, number>();

export function saveTerminalScroll(terminalId: string, viewportY: number): void {
  if (!Number.isFinite(viewportY) || viewportY <= 0) {
    scrollByTerminal.delete(terminalId);
    return;
  }
  scrollByTerminal.set(terminalId, Math.floor(viewportY));
}

export function readTerminalScroll(terminalId: string): number | null {
  return scrollByTerminal.get(terminalId) ?? null;
}

export function clearTerminalScroll(terminalId: string): void {
  scrollByTerminal.delete(terminalId);
}

/** Test seam. */
export function __resetTerminalScrollMemory(): void {
  scrollByTerminal.clear();
}
