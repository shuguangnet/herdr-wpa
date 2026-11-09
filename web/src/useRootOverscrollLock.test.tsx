/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRootOverscrollLock } from "./useRootOverscrollLock";

function Harness({ enabled = true }: { enabled?: boolean }) {
  useRootOverscrollLock(enabled);
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  document.documentElement.style.overscrollBehaviorX = "";
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("useRootOverscrollLock", () => {
  it("keeps the lock while any holder remains and restores afterwards", () => {
    act(() => root.render(<><Harness /><Harness /></>));
    expect(document.documentElement.style.overscrollBehaviorX).toBe("none");

    act(() => root.render(<><Harness /><Harness enabled={false} /></>));
    expect(document.documentElement.style.overscrollBehaviorX).toBe("none");

    act(() => root.render(<><Harness enabled={false} /><Harness enabled={false} /></>));
    expect(document.documentElement.style.overscrollBehaviorX).toBe("");
  });

  it("restores a previous value", () => {
    document.documentElement.style.overscrollBehaviorX = "contain";
    act(() => root.render(<Harness />));
    expect(document.documentElement.style.overscrollBehaviorX).toBe("none");
    act(() => root.render(<Harness enabled={false} />));
    expect(document.documentElement.style.overscrollBehaviorX).toBe("contain");
  });
});
