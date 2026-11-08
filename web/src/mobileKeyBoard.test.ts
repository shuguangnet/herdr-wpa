import { describe, expect, it } from "vitest";

import {
  BOARD_COLS,
  CODE_PREFIX,
  DEFAULT_BOARD,
  MAX_ROWS,
  PRESETS,
  addRow,
  boardKeyLabel,
  canPlace,
  canRemoveRow,
  chordFace,
  decodeBoard,
  encodeBoard,
  encodeChordStep,
  missingCore,
  moveKey,
  normalizeChordStep,
  owners,
  parseChordStep,
  placeKey,
  putBackCore,
  removeRow,
  resizeKey,
  sameBoard,
  sizeOf,
  validateBoard,
  type KeyBoard,
} from "./mobileKeyBoard";

const emptyBoard = (rows = 2): KeyBoard => ({
  rows,
  cells: new Array(rows * BOARD_COLS).fill(null),
});

function withKey(
  board: KeyBoard,
  anchor: number,
  key: Parameters<typeof placeKey>[2],
): KeyBoard {
  const placed = placeKey(board, anchor, key);
  if (!placed.ok) {
    throw new Error(placed.reason);
  }
  return placed.board;
}

describe("chord grammar", () => {
  it("parses modifiers in canonical order", () => {
    expect(parseChordStep("shift+ctrl+alt+t")).toEqual({
      mods: ["ctrl", "alt", "shift"],
      base: "t",
    });
  });

  it("accepts named keys case-insensitively", () => {
    expect(parseChordStep("SHIFT+Tab")).toEqual({ mods: ["shift"], base: "Tab" });
    expect(parseChordStep("Escape")).toEqual({ mods: [], base: "Escape" });
    expect(parseChordStep("space")).toEqual({ mods: [], base: "Space" });
  });

  it("rejects unknown modifiers, repeats and multi-character bases", () => {
    expect(parseChordStep("hyper+x")).toBeNull();
    expect(parseChordStep("ctrl+ctrl+x")).toBeNull();
    expect(parseChordStep("ab")).toBeNull();
    expect(parseChordStep("")).toBeNull();
    expect(parseChordStep("ctrl+")).toBeNull();
  });

  it("normalizes spelling", () => {
    expect(normalizeChordStep("SHIFT+CTRL+t")).toBe("ctrl+shift+t");
    expect(normalizeChordStep("escape")).toBe("Escape");
    expect(normalizeChordStep("nope+")).toBeNull();
  });

  it("encodes steps through the mobile terminal encoder", () => {
    expect(encodeChordStep("ctrl+c")).toBe("\x03");
    expect(encodeChordStep("Escape")).toBe("\x1B");
    expect(encodeChordStep("shift+tab")).toBe("\x1B[Z");
    expect(encodeChordStep("alt+x")).toBe("\x1Bx");
    expect(encodeChordStep("ctrl+Up")).toBe("\x1B[1;5A");
    expect(encodeChordStep("Space")).toBe(" ");
    expect(encodeChordStep("ctrl+hyper+x")).toBeNull();
  });
});

describe("default board", () => {
  it("is valid and carries every core key", () => {
    expect(validateBoard(DEFAULT_BOARD)).toBeNull();
    expect(missingCore(DEFAULT_BOARD)).toEqual([]);
  });

  it("keeps arrows, Esc, Tab, Backspace and Ctrl-C/D on the first screen", () => {
    const labels = DEFAULT_BOARD.cells
      .filter((key) => key !== null)
      .map((key) => boardKeyLabel(key!));
    for (const label of ["Esc", "Tab", "Bksp", "↑", "↓", "←", "→", "C-c", "C-d"]) {
      expect(labels).toContain(label);
    }
  });

  it("exposes two default rows", () => {
    expect(DEFAULT_BOARD.rows).toBe(2);
    expect(DEFAULT_BOARD.cells).toHaveLength(2 * BOARD_COLS);
  });

  it("restores missing core keys on an empty board", () => {
    const restored = putBackCore(emptyBoard());
    expect(missingCore(restored)).toEqual([]);
    expect(validateBoard(restored)).toBeNull();
  });
});

describe("board geometry", () => {
  it("maps covered cells to the anchor", () => {
    const board = withKey(emptyBoard(), 3, { kind: "chord", steps: ["Enter"], w: 2 });
    const own = owners(board);
    expect(own[3]).toBe(3);
    expect(own[4]).toBe(3);
  });

  it("refuses overlap and out-of-range placement", () => {
    const board = withKey(emptyBoard(), 3, { kind: "chord", steps: ["Enter"], w: 2 });
    expect(canPlace(board, 4, 1, 1)).toBe(false);
    expect(canPlace(board, 6, 2, 1)).toBe(false);
    expect(canPlace(board, 0, 1, 2)).toBe(true);
    expect(placeKey(board, 4, { kind: "chord", steps: ["Escape"] }).ok).toBe(false);
  });

  it("moves into free cells", () => {
    let board = withKey(emptyBoard(), 0, { kind: "chord", steps: ["Escape"] });
    const moved = moveKey(board, 0, 5);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    board = moved.board;
    expect(board.cells[5]).not.toBeNull();
    expect(board.cells[0]).toBeNull();
  });

  it("swaps equal sizes", () => {
    let board = withKey(emptyBoard(), 0, { kind: "chord", steps: ["Escape"] });
    board = withKey(board, 1, { kind: "chord", steps: ["Tab"] });
    const swapped = moveKey(board, 0, 1);
    expect(swapped.ok).toBe(true);
    if (!swapped.ok) return;
    expect(boardKeyLabel(swapped.board.cells[0]!)).toBe("Tab");
    expect(boardKeyLabel(swapped.board.cells[1]!)).toBe("Esc");
  });

  it("refuses a move that would overlap a different size", () => {
    let board = withKey(emptyBoard(), 0, { kind: "chord", steps: ["Enter"], w: 2 });
    board = withKey(board, 6, { kind: "chord", steps: ["Escape"] });
    expect(moveKey(board, 6, 0).ok).toBe(false);
  });

  it("grows a key when space allows", () => {
    const board = withKey(emptyBoard(), 0, { kind: "chord", steps: ["Escape"] });
    const grown = resizeKey(board, 0, 2, 1);
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    expect(sizeOf(grown.board.cells[0]!).w).toBe(2);
    expect(owners(grown.board)[1]).toBe(0);
  });

  it("refuses a resize into an occupied cell", () => {
    let board = withKey(emptyBoard(), 0, { kind: "chord", steps: ["Escape"] });
    board = withKey(board, 1, { kind: "chord", steps: ["Tab"] });
    expect(resizeKey(board, 0, 2, 1).ok).toBe(false);
  });

  it("adds and removes only empty trailing rows", () => {
    let board = addRow(emptyBoard(1));
    expect(board.rows).toBe(2);
    expect(canRemoveRow(board)).toBe(true);
    board = removeRow(board);
    expect(board.rows).toBe(1);
    expect(removeRow(board).rows).toBe(1);

    let tall = emptyBoard(2);
    tall = withKey(tall, 0, { kind: "chord", steps: ["Escape"], h: 2 });
    expect(canRemoveRow(tall)).toBe(false);
    expect(removeRow(tall)).toBe(tall);
  });

  it("caps rows at MAX_ROWS", () => {
    const board = addRow(emptyBoard(MAX_ROWS));
    expect(board.rows).toBe(MAX_ROWS);
  });
});

describe("layout code", () => {
  it("round-trips a board", () => {
    const code = encodeBoard(DEFAULT_BOARD);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    const decoded = decodeBoard(code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(sameBoard(decoded.board, DEFAULT_BOARD)).toBe(true);
    }
  });

  it("rejects unknown prefixes, versions, sizes and overlap", () => {
    expect(decodeBoard("collie-keys:2:{}").ok).toBe(false);
    expect(decodeBoard(`${CODE_PREFIX}{"v":2,"rows":2,"cells":[]}`).ok).toBe(false);
    expect(decodeBoard(`${CODE_PREFIX}not json`).ok).toBe(false);
    expect(decodeBoard(CODE_PREFIX).ok).toBe(false);
    expect(decodeBoard(`${CODE_PREFIX}${"x".repeat(5000)}`).ok).toBe(false);

    const overlap: { v: number; rows: number; cells: unknown[] } = {
      v: 1,
      rows: 2,
      cells: new Array(2 * BOARD_COLS).fill(null),
    };
    overlap.cells[0] = { k: "c", s: ["Enter"], w: 2 };
    overlap.cells[1] = { k: "c", s: ["Escape"] };
    expect(decodeBoard(`${CODE_PREFIX}${JSON.stringify(overlap)}`).ok).toBe(false);
  });

  it("rejects invalid chord steps", () => {
    const payload: { v: number; rows: number; cells: unknown[] } = {
      v: 1,
      rows: 2,
      cells: new Array(2 * BOARD_COLS).fill(null),
    };
    payload.cells[0] = { k: "c", s: ["ctrl+hyper+x"] };
    expect(decodeBoard(`${CODE_PREFIX}${JSON.stringify(payload)}`).ok).toBe(false);
  });
});

describe("presets", () => {
  it("are all valid and decodable", () => {
    for (const preset of PRESETS) {
      expect(validateBoard(preset.board)).toBeNull();
      expect(decodeBoard(encodeBoard(preset.board)).ok).toBe(true);
    }
  });

  it("labels multi-step tmux chords compactly", () => {
    const tmux = PRESETS.find((preset) => preset.id === "tmux");
    const key = tmux?.board.cells.find(
      (cell) => cell?.kind === "chord" && cell.steps.length === 2,
    );
    expect(key && key.kind === "chord" ? chordFace(key) : "").toBe("C-b c");
  });
});
