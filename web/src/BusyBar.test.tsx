/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BusyBar } from "./BusyBar";
import { __resetBusyForTest, trackBusy } from "./busy";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  __resetBusyForTest();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  __resetBusyForTest();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("BusyBar", () => {
  it("stays hidden for fast writes", () => {
    vi.useFakeTimers();
    act(() => root.render(<BusyBar delayMs={200} />));
    let finish = () => {};
    act(() => {
      finish = trackBusy();
    });
    act(() => {
      vi.advanceTimersByTime(100);
      finish();
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector(".busy-bar")).toBeNull();
  });

  it("shows for a slow write", () => {
    vi.useFakeTimers();
    act(() => root.render(<BusyBar delayMs={200} />));
    let finish = () => {};
    act(() => {
      finish = trackBusy();
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(container.querySelector(".busy-bar")).not.toBeNull();
    act(() => finish());
    expect(container.querySelector(".busy-bar")).toBeNull();
  });
});
