/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PwaUpdateBar } from "./PwaUpdateBar";
import { usePwaUpdate } from "./usePwaUpdate";

let root: Root;
let container: HTMLDivElement;
let latest: ReturnType<typeof usePwaUpdate> | null = null;

function Harness() {
  latest = usePwaUpdate();
  return <PwaUpdateBar visible={latest.needRefresh} onApply={latest.applyUpdate} onDismiss={latest.dismiss} />;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  latest = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("PwaUpdateBar", () => {
  it("stays hidden until an update needs a reload", () => {
    act(() => root.render(<Harness />));
    expect(container.textContent).toBe("");

    act(() => {
      window.dispatchEvent(new Event("herdr:pwa-update"));
    });
    expect(container.textContent).toContain("New version available");
  });

  it("dismisses without reloading", () => {
    act(() => root.render(<Harness />));
    act(() => {
      window.dispatchEvent(new Event("herdr:pwa-update"));
    });
    const dismiss = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Later",
    )!;
    act(() => dismiss.click());
    expect(container.textContent).toBe("");
    expect(latest?.needRefresh).toBe(false);
  });

  it("applies the update through the registration bridge", () => {
    act(() => root.render(<Harness />));
    act(() => {
      window.dispatchEvent(new Event("herdr:pwa-update"));
    });
    const applyEvent = vi.fn();
    window.addEventListener("herdr:pwa-apply", applyEvent, { once: true });
    const apply = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Update",
    )!;
    act(() => apply.click());
    expect(applyEvent).toHaveBeenCalledOnce();
    expect(container.textContent).toBe("");
  });
});
