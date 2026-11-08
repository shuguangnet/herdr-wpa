/**
 * One derived connection phase for the phone status bar. The inputs come from
 * three places that already exist: the browser online flag, the bridge snapshot
 * load state (with the bridge's own error text) and the terminal socket state.
 *
 * Pure so the copy and the precedence can be tested without a DOM.
 */

export type ConnectionPhase =
  | "offline"
  | "bridge-unreachable"
  | "daemon-unavailable"
  | "terminal-attached"
  | "reconnecting";

export type TerminalConnectionState =
  | "idle"
  | "connecting"
  | "attached"
  | "closed"
  | "error";

export type ConnectionPhaseInput = {
  online: boolean;
  bridgeLoadState: "loading" | "ready" | "error";
  /** True when the bridge reported that Herdr itself is missing or incompatible. */
  daemonUnavailable?: boolean;
  terminalState: TerminalConnectionState;
  /** A reconnect timer is armed or the app is waiting for the network. */
  reconnecting?: boolean;
};

const DAEMON_MARKERS = [
  "daemon",
  "protocol",
  "socket",
  "herdr",
  "upstream",
  "connect_local_stream",
];

/**
 * Classifies a bridge error message. Network failures (fetch, timeout, 502/504)
 * stay bridge-unreachable; anything the bridge says about the daemon or the
 * protocol is surfaced as daemon-unavailable so the copy can point at Herdr.
 */
export function isDaemonUnavailableError(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }
  const lower = message.toLowerCase();
  return DAEMON_MARKERS.some((marker) => lower.includes(marker));
}

export function connectionPhase({
  online,
  bridgeLoadState,
  daemonUnavailable = false,
  terminalState,
  reconnecting = false,
}: ConnectionPhaseInput): ConnectionPhase {
  if (!online) {
    return "offline";
  }
  if (daemonUnavailable) {
    return "daemon-unavailable";
  }
  if (bridgeLoadState === "error") {
    return "bridge-unreachable";
  }
  if (reconnecting || terminalState === "connecting") {
    return "reconnecting";
  }
  if (terminalState === "attached") {
    return "terminal-attached";
  }
  return "reconnecting";
}

export type ConnectionPhaseCopy = {
  title: string;
  hint: string;
  canRetry: boolean;
};

export type ConnectionPhaseCopyOptions = {
  /** False before the first snapshot has loaded, so the copy can say Connecting. */
  hasSnapshot?: boolean;
};

export function connectionPhaseCopy(
  phase: ConnectionPhase,
  options: ConnectionPhaseCopyOptions = {},
): ConnectionPhaseCopy {
  switch (phase) {
    case "offline":
      return {
        title: "Phone offline",
        hint: "Reconnect Wi-Fi or mobile data. Drafts are kept.",
        canRetry: false,
      };
    case "bridge-unreachable":
      return {
        title: "Bridge unreachable",
        hint: "Check the bridge address, port, and that herdr-web-bridge is running.",
        canRetry: true,
      };
    case "daemon-unavailable":
      return {
        title: "Herdr not available",
        hint: "The bridge is up but Herdr is not running, or its terminal protocol is not 22.",
        canRetry: true,
      };
    case "terminal-attached":
      return {
        title: "Connected",
        hint: "",
        canRetry: false,
      };
    case "reconnecting":
      return options.hasSnapshot === false
        ? {
            title: "Connecting",
            hint: "Loading the workspace snapshot.",
            canRetry: false,
          }
        : {
            title: "Reconnecting",
            hint: "Waiting for the terminal and event streams.",
            canRetry: true,
          };
  }
}

export function isOfflinePhase(phase: ConnectionPhase): boolean {
  return phase === "offline" || phase === "bridge-unreachable" || phase === "daemon-unavailable";
}
