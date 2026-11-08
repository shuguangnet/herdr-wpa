/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MobileKeyPadEditor } from "./MobileKeyPadEditor";
import { DEFAULT_BOARD, boardKeyLabel, sizeOf, type KeyBoard } from "./mobileKeyBoard";
import { resetKeyBoard } from "./mobileKeyBoardStore";

let root: Root;
let container: HTMLDivElement;
let onSave: ReturnType<typeof vi.fn<(board: KeyBoard) => void>>;
let onClose: ReturnType<typeof vi.fn<() => void>>;

function button(label: string) {
  const element = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  if (!element) {
    throw new Error(`missing button: ${label}`);
  }
  return element;
}

function buttonByText(text: string) {
  const element = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`missing button with text: ${text}`);
  }
  return element;
}

function click(element: HTMLButtonElement) {
  act(() => element.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  resetKeyBoard();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onSave = vi.fn<(board: KeyBoard) => void>();
  onClose = vi.fn<() => void>();
  act(() => {
    root.render(<MobileKeyPadEditor onSave={onSave} onClose={onClose} />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MobileKeyPadEditor", () => {
  it("renders the current board and closes", () => {
    expect(button("Edit Esc")).toBeTruthy();
    click(buttonByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("adds, resizes and saves a key", () => {
    click(buttonByText("Add row"));
    click(button("Add a key at row 3 column 1"));
    click(buttonByText("2w"));
    click(buttonByText("Save"));
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0];
    expect(saved.rows).toBe(3);
    const added = saved.cells[2 * 7];
    expect(added).not.toBeNull();
    expect(sizeOf(added!).w).toBe(2);
  });

  it("swaps equal-sized keys when the target is occupied", () => {
    click(button("Edit Esc"));
    click(button("Move key right"));
    click(buttonByText("Save"));
    const saved = onSave.mock.calls[0][0];
    expect(boardKeyLabel(saved.cells[0]!)).toBe("Tab");
    expect(boardKeyLabel(saved.cells[1]!)).toBe("Esc");
  });

  it("deletes a key", () => {
    click(button("Edit Esc"));
    click(button("Delete key"));
    click(buttonByText("Save"));
    const saved = onSave.mock.calls[0][0];
    expect(saved.cells[0]).toBeNull();
  });

  it("switches presets", () => {
    click(buttonByText("Navigation"));
    click(buttonByText("Save"));
    const saved = onSave.mock.calls[0][0];
    expect(saved).not.toEqual(DEFAULT_BOARD);
    expect(saved.cells.some((key) => key?.kind === "chord" && key.steps[0] === "PageUp")).toBe(
      true,
    );
  });

  it("exports and imports a layout code", () => {
    const codeArea = () => container.querySelector<HTMLTextAreaElement>("textarea")!;
    click(buttonByText("Export"));
    expect(codeArea().value.startsWith("herdr-keys:1:")).toBe(true);

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(codeArea(), "not-a-layout-code");
      codeArea().dispatchEvent(new Event("input", { bubbles: true }));
    });
    click(buttonByText("Import"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "unknown layout code prefix",
    );
  });

  it("restores missing core keys", () => {
    click(button("Edit Esc"));
    click(button("Delete key"));
    const restore = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent?.trim() === "Restore",
    );
    expect(restore).toBeTruthy();
    click(restore!);
    click(buttonByText("Save"));
    const saved = onSave.mock.calls[0][0];
    expect(saved.cells[0]).not.toBeNull();
  });

  it("reports a resize that does not fit", () => {
    click(buttonByText("Add row"));
    click(button("Add a key at row 3 column 7"));
    click(buttonByText("2w"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("does not fit");
  });
});
