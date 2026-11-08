import { useSyncExternalStore } from "react";

import {
  DEFAULT_BOARD,
  decodeBoard,
  encodeBoard,
  sameBoard,
  type KeyBoard,
} from "./mobileKeyBoard";

/**
 * The phone key board, kept in this browser. One localStorage key, one
 * module-scope value and a listener set, the same shape as `commandDrafts`:
 * the dock and the editor read the same value without a provider.
 *
 * The stored text is the portable layout code, so reading it goes through the
 * same validator as an imported code. Anything missing, truncated, hand-edited
 * or written by a newer format is the default board — never an exception and
 * never half a board.
 */
export const KEY_BOARD_STORAGE_KEY = "herdr.mobileWeb.keyBoard.v1";

function load(): KeyBoard {
  try {
    const raw = globalThis.localStorage?.getItem(KEY_BOARD_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_BOARD;
    }
    const decoded = decodeBoard(raw);
    return decoded.ok ? decoded.board : DEFAULT_BOARD;
  } catch {
    return DEFAULT_BOARD;
  }
}

let board: KeyBoard = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    // The default is the absence of a choice: no key means the app can improve
    // the default board later without a migration.
    if (sameBoard(board, DEFAULT_BOARD)) {
      globalThis.localStorage?.removeItem(KEY_BOARD_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(KEY_BOARD_STORAGE_KEY, encodeBoard(board));
    }
  } catch {
    // Private mode or quota: the in-memory board still applies this session.
  }
}

export function getKeyBoard(): KeyBoard {
  return board;
}

/** Replaces the board, persists it and re-renders every reader. */
export function setKeyBoard(next: KeyBoard): void {
  board = next;
  persist();
  for (const listener of listeners) {
    listener();
  }
}

/** Back to the shipped board; the stored key goes away. */
export function resetKeyBoard(): void {
  setKeyBoard(DEFAULT_BOARD);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The board, live. */
export function useKeyBoard(): KeyBoard {
  return useSyncExternalStore(subscribe, getKeyBoard, getKeyBoard);
}

/** Test seam: re-read storage the way a fresh page load would. */
export function __reloadKeyBoard(): void {
  board = load();
  for (const listener of listeners) {
    listener();
  }
}
