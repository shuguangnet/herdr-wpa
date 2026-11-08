/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionStatusBar } from "./ConnectionStatusBar";
import type { ConnectionPhase } from "./connectionPhase";

let root: Root;
let container: HTMLDivElement;

function render(
  phase: ConnectionPhase,
  retrying = false,
  onRetry = vi.fn(),
  hasSnapshot?: boolean,
) {
  act(() => {
    root.render(
      <ConnectionStatusBar
        phase={phase}
        retrying={retrying}
        hasSnapshot={hasSnapshot}
        onRetry={onRetry}
      />,
    );
  });
  return onRetry;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("ConnectionStatusBar", () => {
  it("stays hidden while attached", () => {
    render("terminal-attached");
    expect(container.textContent).toBe("");
  });

  it("names the phone as offline without offering a retry", () => {
    render("offline");
    expect(container.textContent).toContain("Phone offline");
    expect(container.querySelector("button")).toBeNull();
  });

  it("offers a retry for an unreachable bridge", () => {
    const onRetry = render("bridge-unreachable");
    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.textContent).toContain("Retry");
    act(() => button.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("disables the retry while a refresh is running", () => {
    render("bridge-unreachable", true);
    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Retrying");
  });

  it("points at Herdr when the daemon is missing", () => {
    render("daemon-unavailable");
    expect(container.textContent).toContain("Herdr not available");
    expect(container.textContent).toContain("Herdr");
  });

  it("says Connecting before the first snapshot", () => {
    render("reconnecting", false, vi.fn(), false);
    expect(container.textContent).toContain("Connecting");
    expect(container.querySelector("button")).toBeNull();
  });

  it("exposes a live status role", () => {
    render("reconnecting");
    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });
});
