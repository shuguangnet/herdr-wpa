/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileKeyPad } from "./MobileKeyPad";
import { DEFAULT_BOARD, placeKey, type KeyBoard } from "./mobileKeyBoard";

let root: Root;
let container: HTMLDivElement;
let onSend: ReturnType<typeof vi.fn<(chunks: string[]) => void>>;

function boardWithSingleChar(): KeyBoard {
  const empty: KeyBoard = { rows: 1, cells: new Array(7).fill(null) };
  const withCtrl = placeKey(empty, 0, { kind: "mod", mod: "ctrl" });
  if (!withCtrl.ok) {
    throw new Error(withCtrl.reason);
  }
  const withKey = placeKey(withCtrl.board, 1, { kind: "chord", steps: ["c"] });
  if (!withKey.ok) {
    throw new Error(withKey.reason);
  }
  return withKey.board;
}

function renderBoard(board: KeyBoard, disabled = false) {
  act(() => {
    root.render(<MobileKeyPad board={board} disabled={disabled} onSend={onSend} />);
  });
}

function button(label: string) {
  const element = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  if (!element) {
    throw new Error(`missing button: ${label}`);
  }
  return element;
}

function press(element: HTMLButtonElement, pointerId = 1) {
  act(() => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId,
        isPrimary: true,
        button: 0,
      }),
    );
    element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
}

function click(element: HTMLButtonElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onSend = vi.fn<(chunks: string[]) => void>();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("MobileKeyPad", () => {
  it("renders the default board and sends a chord", () => {
    renderBoard(DEFAULT_BOARD);
    press(button("Send C-c"));
    expect(onSend).toHaveBeenCalledWith(["\x03"]);
  });

  it("keeps dangerous keys behind a second tap", () => {
    renderBoard(DEFAULT_BOARD);
    const danger = button("Send C-d, dangerous");
    click(danger);
    expect(onSend).not.toHaveBeenCalled();
    const confirming = container.querySelector<HTMLButtonElement>(
      '[aria-label="Send C-d, dangerous, tap again to confirm"]',
    );
    expect(confirming?.textContent).toBe("Again");
    click(confirming!);
    expect(onSend).toHaveBeenCalledWith(["\x04"]);
  });

  it("arms a modifier for exactly one key", () => {
    renderBoard(boardWithSingleChar());
    click(button("Ctrl modifier off"));
    expect(button("Ctrl modifier one-shot")).toBeTruthy();
    press(button("Send c"));
    expect(onSend).toHaveBeenLastCalledWith(["\x03"]);
    expect(button("Ctrl modifier off")).toBeTruthy();
    press(button("Send c"));
    expect(onSend).toHaveBeenLastCalledWith(["c"]);
  });

  it("locks a modifier until it is cycled off", () => {
    renderBoard(boardWithSingleChar());
    const ctrl = button("Ctrl modifier off");
    click(ctrl);
    click(button("Ctrl modifier one-shot"));
    expect(button("Ctrl modifier locked")).toBeTruthy();

    press(button("Send c"));
    press(button("Send c"));
    expect(onSend.mock.calls.map(([chunks]) => chunks)).toEqual([["\x03"], ["\x03"]]);

    click(button("Ctrl modifier locked"));
    press(button("Send c"));
    expect(onSend).toHaveBeenLastCalledWith(["c"]);
  });

  it("repeats a held arrow key", () => {
    vi.useFakeTimers();
    renderBoard(DEFAULT_BOARD);
    const up = button("Send ↑");
    act(() => {
      up.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          isPrimary: true,
          button: 0,
        }),
      );
    });
    expect(onSend).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(400 + 60 * 3);
    });
    expect(onSend.mock.calls.length).toBeGreaterThan(3);
    act(() => {
      up.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    });
    const callsAfterRelease = onSend.mock.calls.length;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSend.mock.calls.length).toBe(callsAfterRelease);
  });

  it("does not send while disabled", () => {
    renderBoard(DEFAULT_BOARD, true);
    expect(button("Send C-c").disabled).toBe(true);
  });
});
