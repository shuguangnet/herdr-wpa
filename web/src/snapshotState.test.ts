import { describe, expect, it } from "vitest";
import { commitSnapshotState, snapshotFingerprint } from "./snapshotState";
import type { SnapshotConnectionState } from "./snapshotState";
import type { Snapshot } from "./types";

const snapshot: Snapshot = {
  workspaces: [],
  tabs: [],
  panes: [],
  layouts: [],
  selected_pane_id: null,
};

function state(overrides: Partial<SnapshotConnectionState> = {}): SnapshotConnectionState {
  return {
    connectionKey: "bridge:1",
    snapshot,
    loadState: "ready",
    fingerprint: snapshotFingerprint(snapshot),
    ...overrides,
  };
}

describe("snapshotFingerprint", () => {
  it("matches for structurally equal snapshots", () => {
    expect(snapshotFingerprint(snapshot)).toBe(
      snapshotFingerprint({ ...snapshot, panes: [] }),
    );
  });

  it("changes when snapshot content changes", () => {
    expect(snapshotFingerprint(snapshot)).not.toBe(
      snapshotFingerprint({ ...snapshot, selected_pane_id: "pane-1" }),
    );
  });
});

describe("commitSnapshotState", () => {
  it("returns the previous state object when content is unchanged", () => {
    const previous = { bridge: state() };
    const next = commitSnapshotState(
      previous,
      "bridge",
      "bridge:1",
      { ...snapshot },
      snapshotFingerprint(snapshot),
    );
    expect(next).toBe(previous);
  });

  it("commits when the fingerprint changes", () => {
    const previous = { bridge: state() };
    const changed = { ...snapshot, selected_pane_id: "pane-1" };
    const next = commitSnapshotState(
      previous,
      "bridge",
      "bridge:1",
      changed,
      snapshotFingerprint(changed),
    );
    expect(next).not.toBe(previous);
    expect(next.bridge.snapshot).toBe(changed);
    expect(next.bridge.fingerprint).toBe(snapshotFingerprint(changed));
  });

  it("commits when the connection key changes", () => {
    const previous = { bridge: state() };
    const next = commitSnapshotState(
      previous,
      "bridge",
      "bridge:2",
      snapshot,
      snapshotFingerprint(snapshot),
    );
    expect(next).not.toBe(previous);
    expect(next.bridge.connectionKey).toBe("bridge:2");
  });

  it("commits when the previous load state was not ready", () => {
    const previous = { bridge: state({ loadState: "error" }) };
    const next = commitSnapshotState(
      previous,
      "bridge",
      "bridge:1",
      snapshot,
      snapshotFingerprint(snapshot),
    );
    expect(next).not.toBe(previous);
    expect(next.bridge.loadState).toBe("ready");
  });

  it("commits when the bridge has no previous state", () => {
    const next = commitSnapshotState(
      {},
      "bridge",
      "bridge:1",
      snapshot,
      snapshotFingerprint(snapshot),
    );
    expect(next.bridge.snapshot).toBe(snapshot);
    expect(next.bridge.loadState).toBe("ready");
  });
});
