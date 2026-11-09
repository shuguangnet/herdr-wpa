/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StatusToast } from "./StatusToast";
import type { StatusMessage } from "./status";

let root: Root;
let container: HTMLDivElement;

function render(status: StatusMessage, onDismiss = vi.fn()) {
  act(() => {
    root.render(<StatusToast status={status} onDismiss={onDismiss} />);
  });
  return onDismiss;
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

describe("StatusToast", () => {
  it("shows the latest message with its tone", () => {
    render({ id: 1, text: "Saved", tone: "success" });
    const toast = container.querySelector('[role="status"]');
    expect(toast?.getAttribute("data-tone")).toBe("success");
    expect(toast?.textContent).toContain("Saved");
  });

  it("dismisses on the close button", () => {
    const onDismiss = render({ id: 2, text: "Bridge failed", tone: "error" });
    const dismiss = container.querySelector<HTMLButtonElement>(
      '[aria-label="Dismiss status"]',
    )!;
    act(() => dismiss.click());
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
