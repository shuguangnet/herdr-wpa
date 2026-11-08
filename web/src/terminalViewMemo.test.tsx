/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import { areTerminalViewPropsEqual } from "./TerminalView";
import type { TerminalViewProps } from "./TerminalView";
import type { PaneInfo } from "./types";

const pane: PaneInfo = {
  pane_id: "pane-1",
  terminal_id: "terminal-1",
  workspace_id: "workspace-1",
  tab_id: "tab-1",
  focused: false,
  agent_status: "idle",
  revision: 1,
};

const httpUrl = () => "";
const wsUrl = () => "";

function props(overrides: Partial<TerminalViewProps> = {}): TerminalViewProps {
  return {
    bridgeId: "bridge-a",
    pane,
    connectionKey: "bridge-a:1",
    resumeToken: 0,
    httpUrl,
    wsUrl,
    accessibilityLabel: "Pane 1 of 1 terminal: shell",
    selected: true,
    ...overrides,
  };
}

describe("areTerminalViewPropsEqual", () => {
  it("treats equal props as unchanged", () => {
    expect(areTerminalViewPropsEqual(props(), props())).toBe(true);
  });

  it("ignores a new pane object when terminal identity is unchanged", () => {
    // Snapshot refreshes rebuild every pane object; only identity matters here.
    expect(
      areTerminalViewPropsEqual(props(), props({ pane: { ...pane, revision: 2 } })),
    ).toBe(true);
  });

  it("re-renders when the terminal id changes", () => {
    expect(
      areTerminalViewPropsEqual(
        props(),
        props({ pane: { ...pane, terminal_id: "terminal-2" } }),
      ),
    ).toBe(false);
  });

  it("re-renders when the pane id changes", () => {
    expect(
      areTerminalViewPropsEqual(props(), props({ pane: { ...pane, pane_id: "pane-2" } })),
    ).toBe(false);
  });

  it("handles missing panes", () => {
    expect(
      areTerminalViewPropsEqual(props({ pane: null }), props({ pane: null })),
    ).toBe(true);
    expect(areTerminalViewPropsEqual(props(), props({ pane: null }))).toBe(false);
  });

  it("re-renders when a non-pane prop changes", () => {
    expect(
      areTerminalViewPropsEqual(props(), props({ accessibilityLabel: "different" })),
    ).toBe(false);
    expect(areTerminalViewPropsEqual(props(), props({ selected: false }))).toBe(false);
    expect(areTerminalViewPropsEqual(props(), props({ resumeToken: 1 }))).toBe(false);
  });
});
