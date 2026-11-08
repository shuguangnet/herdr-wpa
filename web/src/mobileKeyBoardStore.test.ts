/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_BOARD, addRow, encodeBoard, sameBoard } from "./mobileKeyBoard";
import {
  KEY_BOARD_STORAGE_KEY,
  __reloadKeyBoard,
  getKeyBoard,
  resetKeyBoard,
  setKeyBoard,
} from "./mobileKeyBoardStore";

beforeEach(() => {
  localStorage.clear();
  resetKeyBoard();
  __reloadKeyBoard();
});

describe("mobileKeyBoardStore", () => {
  it("starts on the default board without storing anything", () => {
    expect(sameBoard(getKeyBoard(), DEFAULT_BOARD)).toBe(true);
    expect(localStorage.getItem(KEY_BOARD_STORAGE_KEY)).toBeNull();
  });

  it("persists an edited board and reloads it", () => {
    const edited = addRow(DEFAULT_BOARD);
    setKeyBoard(edited);
    expect(localStorage.getItem(KEY_BOARD_STORAGE_KEY)).not.toBeNull();

    __reloadKeyBoard();
    expect(sameBoard(getKeyBoard(), edited)).toBe(true);
  });

  it("drops the stored key when the board matches the default again", () => {
    setKeyBoard(addRow(DEFAULT_BOARD));
    expect(localStorage.getItem(KEY_BOARD_STORAGE_KEY)).not.toBeNull();
    setKeyBoard(DEFAULT_BOARD);
    expect(localStorage.getItem(KEY_BOARD_STORAGE_KEY)).toBeNull();
  });

  it("falls back to the default for corrupt or unsupported values", () => {
    for (const raw of [
      "not-a-layout-code",
      `${"herdr-keys:1:"}{"v":1,"rows":2,"cells":[]}`,
      encodeBoard(DEFAULT_BOARD).replace("herdr-keys:1:", "herdr-keys:9:"),
    ]) {
      localStorage.setItem(KEY_BOARD_STORAGE_KEY, raw);
      __reloadKeyBoard();
      expect(sameBoard(getKeyBoard(), DEFAULT_BOARD)).toBe(true);
    }
  });

  it("reset removes the stored key", () => {
    setKeyBoard(addRow(DEFAULT_BOARD));
    resetKeyBoard();
    expect(localStorage.getItem(KEY_BOARD_STORAGE_KEY)).toBeNull();
    expect(sameBoard(getKeyBoard(), DEFAULT_BOARD)).toBe(true);
  });

});
