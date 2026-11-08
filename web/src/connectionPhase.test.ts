import { describe, expect, it } from "vitest";

import {
  connectionPhase,
  connectionPhaseCopy,
  isDaemonUnavailableError,
  isOfflinePhase,
} from "./connectionPhase";

const base = {
  online: true,
  bridgeLoadState: "ready" as const,
  terminalState: "attached" as const,
};

describe("connectionPhase", () => {
  it("reports offline before anything else", () => {
    expect(connectionPhase({ ...base, online: false })).toBe("offline");
    expect(connectionPhase({ ...base, online: false, bridgeLoadState: "error" })).toBe("offline");
  });

  it("separates daemon failures from bridge failures", () => {
    expect(
      connectionPhase({ ...base, bridgeLoadState: "error", daemonUnavailable: true }),
    ).toBe("daemon-unavailable");
    expect(connectionPhase({ ...base, bridgeLoadState: "error" })).toBe("bridge-unreachable");
  });

  it("reports reconnecting while the terminal is connecting", () => {
    expect(connectionPhase({ ...base, terminalState: "connecting" })).toBe("reconnecting");
    expect(connectionPhase({ ...base, reconnecting: true })).toBe("reconnecting");
  });

  it("reports attached only when the terminal is attached", () => {
    expect(connectionPhase(base)).toBe("terminal-attached");
    expect(connectionPhase({ ...base, terminalState: "idle" })).toBe("reconnecting");
    expect(connectionPhase({ ...base, terminalState: "closed" })).toBe("reconnecting");
    expect(connectionPhase({ ...base, terminalState: "error" })).toBe("reconnecting");
  });

  it("prefers a bridge error over an attached terminal", () => {
    expect(connectionPhase({ ...base, bridgeLoadState: "error" })).toBe("bridge-unreachable");
  });
});

describe("isDaemonUnavailableError", () => {
  it("recognizes daemon and protocol wording", () => {
    expect(isDaemonUnavailableError("herdr daemon not running")).toBe(true);
    expect(isDaemonUnavailableError("terminal protocol mismatch: expected 22")).toBe(true);
    expect(isDaemonUnavailableError("connect_local_stream: no such file")).toBe(true);
    expect(isDaemonUnavailableError("snapshot failed: 502")).toBe(false);
    expect(isDaemonUnavailableError(null)).toBe(false);
    expect(isDaemonUnavailableError("")).toBe(false);
  });
});

describe("copy", () => {
  it("gives every phase a title and a retry decision", () => {
    const phases = [
      "offline",
      "bridge-unreachable",
      "daemon-unavailable",
      "terminal-attached",
      "reconnecting",
    ] as const;
    for (const phase of phases) {
      const copy = connectionPhaseCopy(phase);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(typeof copy.canRetry).toBe("boolean");
    }
    expect(connectionPhaseCopy("offline").canRetry).toBe(false);
    expect(connectionPhaseCopy("terminal-attached").canRetry).toBe(false);
  });

  it("marks blocking phases as offline-like", () => {
    expect(isOfflinePhase("offline")).toBe(true);
    expect(isOfflinePhase("bridge-unreachable")).toBe(true);
    expect(isOfflinePhase("daemon-unavailable")).toBe(true);
    expect(isOfflinePhase("reconnecting")).toBe(false);
    expect(isOfflinePhase("terminal-attached")).toBe(false);
  });
});
