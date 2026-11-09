import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetTerminalScrollMemory,
  clearTerminalScroll,
  readTerminalScroll,
  saveTerminalScroll,
} from "./scrollMemory";

beforeEach(() => {
  __resetTerminalScrollMemory();
});

describe("terminal scroll memory", () => {
  it("remembers and clears a position", () => {
    saveTerminalScroll("term-1", 42);
    expect(readTerminalScroll("term-1")).toBe(42);
    clearTerminalScroll("term-1");
    expect(readTerminalScroll("term-1")).toBeNull();
  });

  it("drops the entry at the bottom", () => {
    saveTerminalScroll("term-1", 42);
    saveTerminalScroll("term-1", 0);
    expect(readTerminalScroll("term-1")).toBeNull();
  });

  it("ignores invalid values", () => {
    saveTerminalScroll("term-1", 42);
    saveTerminalScroll("term-1", Number.NaN);
    expect(readTerminalScroll("term-1")).toBeNull();
  });

  it("keeps terminals separate", () => {
    saveTerminalScroll("term-1", 10);
    saveTerminalScroll("term-2", 20);
    expect(readTerminalScroll("term-1")).toBe(10);
    expect(readTerminalScroll("term-2")).toBe(20);
  });
});
