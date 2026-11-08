import {
  MOBILE_TERMINAL_SPECIAL_KEYS,
  encodeMobileTerminalChord,
  mobileTerminalPrintableKey,
} from "./mobileTerminalControls";
import type {
  MobileTerminalChordKey,
  MobileTerminalModifier,
} from "./mobileTerminalControls";

/**
 * The phone key board as data: a fixed 7-column grid where a key is anchored on
 * one cell and spans 1–3 columns and 1–2 rows. Every chord is sent through the
 * existing mobile terminal encoder, so this module only decides *what* to send.
 *
 * Kept pure (no React, no storage, no clock) so the layout rules, the chord
 * grammar and the layout code can be unit tested without a DOM.
 */

export const BOARD_COLS = 7;
export const MIN_ROWS = 1;
export const MAX_ROWS = 8;
export const MAX_KEYS = BOARD_COLS * MAX_ROWS;
export const MAX_STEPS = 4;
export const MAX_LABEL = 12;
export const MAX_CODE_LENGTH = 4096;
export const CODE_PREFIX = "herdr-keys:1:";
export const SCHEMA = 1;
export const MAX_W = 3;
export const MAX_H = 2;

export type ModifierName = "ctrl" | "alt" | "shift";
export const MODIFIER_ORDER: readonly ModifierName[] = ["ctrl", "alt", "shift"];

export type KeyWidth = 1 | 2 | 3;
export type KeyHeight = 1 | 2;

export type ModBoardKey = {
  kind: "mod";
  mod: ModifierName;
  w?: KeyWidth;
  h?: KeyHeight;
};

export type ChordBoardKey = {
  kind: "chord";
  /** Canonical chord steps, 1–4, each like `ctrl+alt+t` or `Escape`. */
  steps: string[];
  label?: string;
  danger?: boolean;
  w?: KeyWidth;
  h?: KeyHeight;
};

export type BoardKey = ModBoardKey | ChordBoardKey;

export type KeyBoard = {
  rows: number;
  /** `rows * BOARD_COLS` cells; a key sits on its anchor, covered cells are null. */
  cells: (BoardKey | null)[];
};

export type ParsedStep = {
  mods: ModifierName[];
  base: string;
};

export type BoardResult = { ok: true; board: KeyBoard } | { ok: false; reason: string };

export type KeyResult = { ok: true; board: KeyBoard } | { ok: false; reason: string };

/** Step spelling → the encoder's key name. */
const NAMED_STEP_NAMES: Readonly<Record<string, string>> = {
  escape: "Escape",
  tab: "Tab",
  backspace: "Backspace",
  left: "Left",
  up: "Up",
  down: "Down",
  right: "Right",
  enter: "Enter",
  home: "Home",
  end: "End",
  delete: "Delete",
  pageup: "Page Up",
  pagedown: "Page Down",
  space: "Space",
};

const STEP_NAME_BY_LOWER = new Map(
  Object.entries(NAMED_STEP_NAMES).map(([lower, keyName]) => [lower, lower === "pageup"
    ? "PageUp"
    : lower === "pagedown"
      ? "PageDown"
      : keyName]),
);

export function cellPosition(index: number) {
  return { row: Math.floor(index / BOARD_COLS), col: index % BOARD_COLS };
}

export function sizeOf(key: BoardKey): { w: KeyWidth; h: KeyHeight } {
  return { w: key.w ?? 1, h: key.h ?? 1 };
}

export function isModifierName(value: string): value is ModifierName {
  return (MODIFIER_ORDER as readonly string[]).includes(value);
}

/** Parses one chord step such as `ctrl+alt+t`, `Shift+Tab` or `Escape`. */
export function parseChordStep(step: string): ParsedStep | null {
  const trimmed = step.trim();
  if (trimmed.length === 0 || trimmed.length > 40) {
    return null;
  }
  const parts = trimmed.split("+");
  if (parts.some((part) => part.length === 0)) {
    return null;
  }
  const base = parts.at(-1)!;
  const mods: ModifierName[] = [];
  for (const raw of parts.slice(0, -1)) {
    const lower = raw.toLowerCase();
    if (!isModifierName(lower) || mods.includes(lower)) {
      return null;
    }
    mods.push(lower);
  }
  if (mods.length > MODIFIER_ORDER.length) {
    return null;
  }
  const named = STEP_NAME_BY_LOWER.get(base.toLowerCase());
  if (named) {
    return { mods: MODIFIER_ORDER.filter((mod) => mods.includes(mod)), base: named };
  }
  if (Array.from(base).length !== 1) {
    return null;
  }
  return { mods: MODIFIER_ORDER.filter((mod) => mods.includes(mod)), base };
}

/** Canonical spelling for a step, or null when the step is invalid. */
export function normalizeChordStep(step: string): string | null {
  const parsed = parseChordStep(step);
  if (!parsed) {
    return null;
  }
  return [...parsed.mods, parsed.base].join("+");
}

export function isNamedKey(base: string): boolean {
  return STEP_NAME_BY_LOWER.has(base.toLowerCase());
}

function encoderKey(forStep: ParsedStep): MobileTerminalChordKey | null {
  if (isNamedKey(forStep.base)) {
    const name = NAMED_STEP_NAMES[forStep.base.toLowerCase()];
    if (name === "Space") {
      return mobileTerminalPrintableKey(" ");
    }
    return MOBILE_TERMINAL_SPECIAL_KEYS.find((key) => key.name === name) ?? null;
  }
  const characters = Array.from(forStep.base);
  if (characters.length !== 1) {
    return null;
  }
  return mobileTerminalPrintableKey(characters[0]);
}

/** Encodes one chord step to the terminal bytes it should send. */
export function encodeChordStep(step: string): string | null {
  const parsed = parseChordStep(step);
  if (!parsed) {
    return null;
  }
  const key = encoderKey(parsed);
  if (!key) {
    return null;
  }
  return encodeMobileTerminalChord(key, parsed.mods as MobileTerminalModifier[]);
}

/** Merges sticky modifiers into a step, keeping canonical order and no repeats. */
export function applyModifiers(
  step: string,
  mods: readonly ModifierName[],
): string | null {
  const parsed = parseChordStep(step);
  if (!parsed) {
    return null;
  }
  const merged = MODIFIER_ORDER.filter(
    (mod) => mods.includes(mod) || parsed.mods.includes(mod),
  );
  return [...merged, parsed.base].join("+");
}

const REPEATABLE_BASES: ReadonlySet<string> = new Set([
  "Up",
  "Down",
  "Left",
  "Right",
  "Backspace",
  "Space",
]);

/** Whether holding this key should repeat it (arrows, Backspace, Space). */
export function isRepeatableKey(key: BoardKey): boolean {
  if (key.kind !== "chord" || key.steps.length !== 1) {
    return false;
  }
  const parsed = parseChordStep(key.steps[0]);
  return parsed !== null && parsed.mods.length === 0 && REPEATABLE_BASES.has(parsed.base);
}

/** Validates one board key; returns a readable reason or null. */
export function validateKey(key: BoardKey): string | null {
  if (key.kind === "mod") {
    if (!isModifierName(key.mod)) {
      return "unknown modifier";
    }
  } else if (key.kind === "chord") {
    if (!Array.isArray(key.steps) || key.steps.length === 0) {
      return "a key needs at least one step";
    }
    if (key.steps.length > MAX_STEPS) {
      return `a key sends at most ${MAX_STEPS} steps`;
    }
    for (const step of key.steps) {
      if (normalizeChordStep(step) === null) {
        return `invalid chord step: ${step}`;
      }
    }
    if (key.label !== undefined && Array.from(key.label).length > MAX_LABEL) {
      return `label is longer than ${MAX_LABEL} characters`;
    }
  } else {
    return "unknown key kind";
  }
  const { w, h } = sizeOf(key);
  if (![1, 2, 3].includes(w) || ![1, 2].includes(h)) {
    return "invalid key size";
  }
  return null;
}

function computeOwners(board: KeyBoard): { owners: number[]; error: string | null } {
  const owners = new Array<number>(board.rows * BOARD_COLS).fill(-1);
  for (let index = 0; index < board.cells.length; index += 1) {
    const key = board.cells[index];
    if (!key) {
      continue;
    }
    const { w, h } = sizeOf(key);
    const { row, col } = cellPosition(index);
    if (col + w > BOARD_COLS || row + h > board.rows) {
      return { owners, error: `key at cell ${index} does not fit the board` };
    }
    for (let dr = 0; dr < h; dr += 1) {
      for (let dc = 0; dc < w; dc += 1) {
        const cell = (row + dr) * BOARD_COLS + (col + dc);
        if (owners[cell] !== -1) {
          return { owners, error: `keys overlap at cell ${cell}` };
        }
        owners[cell] = index;
      }
    }
  }
  return { owners, error: null };
}

/** Cell index → owning anchor index, or -1. */
export function owners(board: KeyBoard): number[] {
  return computeOwners(board).owners;
}

export function keyCount(board: KeyBoard): number {
  return board.cells.filter((key) => key !== null).length;
}

export function validateBoard(board: KeyBoard): string | null {
  if (!Number.isInteger(board.rows) || board.rows < MIN_ROWS || board.rows > MAX_ROWS) {
    return `rows must be ${MIN_ROWS}–${MAX_ROWS}`;
  }
  if (board.cells.length !== board.rows * BOARD_COLS) {
    return "cell count does not match rows";
  }
  for (const key of board.cells) {
    if (key === null) {
      continue;
    }
    const reason = validateKey(key);
    if (reason) {
      return reason;
    }
  }
  return computeOwners(board).error;
}

export function canPlace(
  board: KeyBoard,
  anchor: number,
  w: KeyWidth,
  h: KeyHeight,
  ignoreIndex = -1,
): boolean {
  if (anchor < 0 || anchor >= board.cells.length) {
    return false;
  }
  const { row, col } = cellPosition(anchor);
  if (col + w > BOARD_COLS || row + h > board.rows) {
    return false;
  }
  const own = computeOwners(board).owners;
  for (let dr = 0; dr < h; dr += 1) {
    for (let dc = 0; dc < w; dc += 1) {
      const owner = own[(row + dr) * BOARD_COLS + (col + dc)];
      if (owner !== -1 && owner !== ignoreIndex) {
        return false;
      }
    }
  }
  return true;
}

export function placeKey(board: KeyBoard, anchor: number, key: BoardKey): KeyResult {
  const reason = validateKey(key);
  if (reason) {
    return { ok: false, reason };
  }
  const { w, h } = sizeOf(key);
  if (!canPlace(board, anchor, w, h)) {
    return { ok: false, reason: "the key does not fit there" };
  }
  const cells = [...board.cells];
  cells[anchor] = key;
  return { ok: true, board: { rows: board.rows, cells } };
}

export function removeKey(board: KeyBoard, anchor: number): KeyBoard {
  if (!board.cells[anchor]) {
    return board;
  }
  const cells = [...board.cells];
  cells[anchor] = null;
  return { rows: board.rows, cells };
}

/** Moves a key; a drop onto a key of the same size swaps them. */
export function moveKey(board: KeyBoard, from: number, to: number): KeyResult {
  const key = board.cells[from];
  if (!key || from === to) {
    return { ok: true, board };
  }
  const own = computeOwners(board);
  if (own.error) {
    return { ok: false, reason: own.error };
  }
  const { w, h } = sizeOf(key);
  const targetAnchor = own.owners[to];
  if (targetAnchor === -1) {
    if (!canPlace(board, to, w, h, from)) {
      return { ok: false, reason: "the key does not fit there" };
    }
    const cells = [...board.cells];
    cells[from] = null;
    cells[to] = key;
    return { ok: true, board: { rows: board.rows, cells } };
  }
  if (targetAnchor === from) {
    return { ok: true, board };
  }
  const target = board.cells[targetAnchor]!;
  const targetSize = sizeOf(target);
  if (targetSize.w !== w || targetSize.h !== h) {
    return { ok: false, reason: "only keys of the same size can swap" };
  }
  const cells = [...board.cells];
  cells[from] = null;
  cells[targetAnchor] = null;
  const first = placeKey({ rows: board.rows, cells }, to, key);
  if (!first.ok) {
    return first;
  }
  const second = placeKey(first.board, from, target);
  if (!second.ok) {
    return second;
  }
  return second;
}

export function resizeKey(
  board: KeyBoard,
  anchor: number,
  w: KeyWidth,
  h: KeyHeight,
): KeyResult {
  const key = board.cells[anchor];
  if (!key) {
    return { ok: false, reason: "no key at that cell" };
  }
  if (!canPlace(board, anchor, w, h, anchor)) {
    return { ok: false, reason: "the key does not fit there" };
  }
  const cells = [...board.cells];
  cells[anchor] = { ...key, w, h };
  return { ok: true, board: { rows: board.rows, cells } };
}

export function addRow(board: KeyBoard): KeyBoard {
  if (board.rows >= MAX_ROWS) {
    return board;
  }
  return { rows: board.rows + 1, cells: [...board.cells, ...new Array(BOARD_COLS).fill(null)] };
}

export function canRemoveRow(board: KeyBoard): boolean {
  if (board.rows <= MIN_ROWS) {
    return false;
  }
  const own = computeOwners(board).owners;
  const start = (board.rows - 1) * BOARD_COLS;
  for (let index = start; index < board.cells.length; index += 1) {
    const owner = own[index];
    if (owner !== -1 && owner < start) {
      return false;
    }
  }
  return true;
}

export function removeRow(board: KeyBoard): KeyBoard {
  if (!canRemoveRow(board)) {
    return board;
  }
  return {
    rows: board.rows - 1,
    cells: board.cells.slice(0, (board.rows - 1) * BOARD_COLS),
  };
}

const NAMED_FACE: Readonly<Record<string, string>> = {
  Escape: "Esc",
  Backspace: "Bksp",
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Delete: "Del",
};

/** Short face for a chord: `C-c`, `C-b c`, `A-←`. */
export function chordFace(key: ChordBoardKey): string {
  const faces = key.steps.map((step) => {
    const parsed = parseChordStep(step);
    if (!parsed) {
      return step;
    }
    const mods = parsed.mods.map((mod) => (mod === "ctrl" ? "C" : mod === "alt" ? "A" : "S"));
    const base = NAMED_FACE[parsed.base] ?? parsed.base;
    return [...mods, base].join("-");
  });
  return faces.join(" ");
}

export function boardKeyLabel(key: BoardKey): string {
  if (key.kind === "mod") {
    return key.mod === "ctrl" ? "Ctrl" : key.mod === "alt" ? "Alt" : "Shift";
  }
  return key.label ?? chordFace(key);
}

/** The board's steps in send order, or null when a step cannot be encoded. */
export function keySteps(key: BoardKey): string[] | null {
  if (key.kind === "mod") {
    return null;
  }
  const encoded: string[] = [];
  for (const step of key.steps) {
    const bytes = encodeChordStep(step);
    if (bytes === null) {
      return null;
    }
    encoded.push(bytes);
  }
  return encoded;
}

/** The keys whose loss is worth a word: a phone has no other Esc, Enter or arrows. */
export const CORE_KEYS: readonly { name: string; step: string; home: number }[] = [
  { name: "Esc", step: "Escape", home: 0 },
  { name: "Tab", step: "Tab", home: 1 },
  { name: "Backspace", step: "Backspace", home: 2 },
  { name: "Up", step: "Up", home: 4 },
  { name: "Left", step: "Left", home: 7 },
  { name: "Down", step: "Down", home: 8 },
  { name: "Right", step: "Right", home: 9 },
];

const holdsStep = (board: KeyBoard, step: string): boolean =>
  board.cells.some(
    (key) =>
      key !== null && key.kind === "chord" && key.steps.length === 1 && key.steps[0] === step,
  );

export function missingCore(board: KeyBoard): string[] {
  return CORE_KEYS.filter((core) => !holdsStep(board, core.step)).map((core) => core.name);
}

function boardOf(rows: number, entries: [number, BoardKey][]): KeyBoard {
  const cells: (BoardKey | null)[] = new Array(rows * BOARD_COLS).fill(null);
  for (const [index, key] of entries) {
    cells[index] = key;
  }
  return { rows, cells };
}

const chord = (steps: string[], extra: Partial<ChordBoardKey> = {}): ChordBoardKey => ({
  kind: "chord",
  steps,
  ...extra,
});

const mod = (name: ModifierName): ModBoardKey => ({ kind: "mod", mod: name });

/** Two rows: the keys a phone cannot produce without a keyboard. */
export const DEFAULT_BOARD: KeyBoard = boardOf(2, [
  [0, chord(["Escape"])],
  [1, chord(["Tab"])],
  [2, chord(["Backspace"])],
  [3, mod("ctrl")],
  [4, chord(["Up"])],
  [5, chord(["ctrl+c"])],
  [6, chord(["ctrl+d"], { danger: true })],
  [7, chord(["Left"])],
  [8, chord(["Down"])],
  [9, chord(["Right"])],
  [10, chord(["Enter"], { w: 2 })],
  [12, mod("shift")],
  [13, mod("alt")],
]);

const NAVIGATION_BOARD: KeyBoard = boardOf(2, [
  [0, chord(["Escape"])],
  [1, chord(["Home"])],
  [2, chord(["Up"])],
  [3, chord(["End"])],
  [4, chord(["PageUp"])],
  [5, chord(["PageDown"])],
  [6, chord(["Delete"])],
  [7, chord(["Left"])],
  [8, chord(["Down"])],
  [9, chord(["Right"])],
  [10, chord(["Tab"])],
  [11, chord(["Enter"], { w: 2 })],
  [13, chord(["ctrl+c"])],
]);

const TMUX_BOARD: KeyBoard = boardOf(2, [
  [0, chord(["ctrl+b"])],
  [1, chord(["ctrl+b", "c"], { label: "new" })],
  [2, chord(["ctrl+b", "n"], { label: "next" })],
  [3, chord(["ctrl+b", "p"], { label: "prev" })],
  [4, chord(["ctrl+b", "d"], { label: "detach" })],
  [5, chord(["Escape"])],
  [6, chord(["ctrl+c"])],
  [7, chord(["Left"])],
  [8, chord(["Up"])],
  [9, chord(["Down"])],
  [10, chord(["Right"])],
  [11, chord(["Enter"], { w: 2 })],
  [13, chord(["Tab"])],
]);

export type BoardPreset = { id: string; label: string; board: KeyBoard };

export const PRESETS: readonly BoardPreset[] = [
  { id: "default", label: "Default", board: DEFAULT_BOARD },
  { id: "navigation", label: "Navigation", board: NAVIGATION_BOARD },
  { id: "tmux", label: "tmux", board: TMUX_BOARD },
];

type SerializedKey =
  | { k: "m"; m: ModifierName; w?: number; h?: number }
  | { k: "c"; s: string[]; l?: string; d?: boolean; w?: number; h?: number };

type SerializedBoard = { v: number; rows: number; cells: (SerializedKey | null)[] };

function serializeKey(key: BoardKey): SerializedKey {
  if (key.kind === "mod") {
    return { k: "m", m: key.mod, ...sizeFields(key) };
  }
  return {
    k: "c",
    s: key.steps,
    ...(key.label !== undefined ? { l: key.label } : {}),
    ...(key.danger ? { d: true } : {}),
    ...sizeFields(key),
  };
}

function sizeFields(key: BoardKey): { w?: number; h?: number } {
  return {
    ...(key.w !== undefined && key.w !== 1 ? { w: key.w } : {}),
    ...(key.h !== undefined && key.h !== 1 ? { h: key.h } : {}),
  };
}

function deserializeKey(value: unknown): BoardKey | string {
  if (!isRecord(value)) {
    return "key must be an object";
  }
  const w = value.w === undefined ? 1 : value.w;
  const h = value.h === undefined ? 1 : value.h;
  if (w !== 1 && w !== 2 && w !== 3) {
    return "invalid key width";
  }
  if (h !== 1 && h !== 2) {
    return "invalid key height";
  }
  if (value.k === "m") {
    if (typeof value.m !== "string" || !isModifierName(value.m)) {
      return "invalid modifier";
    }
    return { kind: "mod", mod: value.m, w, h };
  }
  if (value.k === "c") {
    if (!Array.isArray(value.s) || value.s.some((step) => typeof step !== "string")) {
      return "chord steps must be strings";
    }
    const key: ChordBoardKey = { kind: "chord", steps: value.s as string[], w, h };
    if (value.l !== undefined) {
      if (typeof value.l !== "string") {
        return "invalid label";
      }
      key.label = value.l;
    }
    if (value.d !== undefined) {
      if (typeof value.d !== "boolean") {
        return "invalid danger flag";
      }
      key.danger = value.d;
    }
    return key;
  }
  return "unknown key kind";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A portable layout code; the prefix carries the format version. */
export function encodeBoard(board: KeyBoard): string {
  const payload: SerializedBoard = {
    v: SCHEMA,
    rows: board.rows,
    cells: board.cells.map((key) => (key ? serializeKey(key) : null)),
  };
  return `${CODE_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeBoard(code: string): BoardResult {
  const trimmed = code.trim();
  if (trimmed.length > MAX_CODE_LENGTH) {
    return { ok: false, reason: "layout code is too long" };
  }
  if (!trimmed.startsWith(CODE_PREFIX)) {
    return { ok: false, reason: "unknown layout code prefix" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(CODE_PREFIX.length));
  } catch {
    return { ok: false, reason: "layout code is not valid JSON" };
  }
  if (!isRecord(parsed) || parsed.v !== SCHEMA) {
    return { ok: false, reason: "unsupported layout code version" };
  }
  if (!Number.isInteger(parsed.rows) || !Array.isArray(parsed.cells)) {
    return { ok: false, reason: "invalid layout shape" };
  }
  const rows = parsed.rows as number;
  if (rows < MIN_ROWS || rows > MAX_ROWS) {
    return { ok: false, reason: `rows must be ${MIN_ROWS}–${MAX_ROWS}` };
  }
  if (parsed.cells.length !== rows * BOARD_COLS) {
    return { ok: false, reason: "cell count does not match rows" };
  }
  const cells: (BoardKey | null)[] = [];
  for (const value of parsed.cells) {
    if (value === null) {
      cells.push(null);
      continue;
    }
    const key = deserializeKey(value);
    if (typeof key === "string") {
      return { ok: false, reason: key };
    }
    const reason = validateKey(key);
    if (reason) {
      return { ok: false, reason };
    }
    cells.push(key);
  }
  const board: KeyBoard = { rows, cells };
  const reason = validateBoard(board);
  if (reason) {
    return { ok: false, reason };
  }
  return { ok: true, board };
}

export function sameBoard(a: KeyBoard, b: KeyBoard): boolean {
  return encodeBoard(a) === encodeBoard(b);
}

/** Puts every missing core key back in its home cell or the first free cell. */
export function putBackCore(board: KeyBoard): KeyBoard {
  let next = board;
  for (const core of CORE_KEYS) {
    if (holdsStep(next, core.step)) {
      continue;
    }
    const own = owners(next);
    const home = core.home < own.length && own[core.home] === -1 ? core.home : own.indexOf(-1);
    if (home < 0) {
      next = addRow(next);
      if (next.cells.length === board.cells.length) {
        return next;
      }
      return putBackCore(next);
    }
    const placed = placeKey(next, home, chord([core.step]));
    if (!placed.ok) {
      return next;
    }
    next = placed.board;
  }
  return next;
}
