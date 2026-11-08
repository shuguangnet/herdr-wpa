import type { Snapshot } from "./types";

/**
 * The subset of bridge connection state that snapshot commits care about.
 * Kept structural so the pure commit helper can be unit tested without
 * importing the app component.
 */
export type SnapshotConnectionState = {
  connectionKey: string;
  snapshot: Snapshot | null;
  loadState: "loading" | "ready" | "error";
  fingerprint?: string | null;
};

/**
 * Serializes a snapshot so unchanged content can be detected without a deep
 * comparison. Snapshots are produced by the same bridge schema, so property
 * order is stable for equal payloads.
 */
export function snapshotFingerprint(snapshot: Snapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * Commits a refreshed snapshot into bridge connection state, returning the
 * previous state object when the payload did not change. Returning the same
 * object reference lets React skip the whole tree re-render for idle refresh
 * cycles and event-driven refreshes that raced an in-flight snapshot.
 */
export function commitSnapshotState<T extends SnapshotConnectionState>(
  states: Record<string, T>,
  bridgeId: string,
  connectionKey: string,
  snapshot: Snapshot,
  fingerprint: string,
): Record<string, T> {
  const existing = states[bridgeId];
  if (
    existing &&
    existing.connectionKey === connectionKey &&
    existing.loadState === "ready" &&
    existing.fingerprint === fingerprint
  ) {
    return states;
  }
  return {
    ...states,
    [bridgeId]: {
      connectionKey,
      snapshot,
      loadState: "ready",
      fingerprint,
      error: null,
    } as unknown as T,
  };
}
