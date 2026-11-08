import { describe, expect, it } from "vitest";

import { parseTerminalSizeMessage } from "./terminalSize";

describe("parseTerminalSizeMessage", () => {
  it("reads the bridge PTY size", () => {
    expect(parseTerminalSizeMessage('{"type":"terminal_size","cols":120,"rows":40}')).toEqual({
      cols: 120,
      rows: 40,
    });
  });

  it("ignores other messages and malformed sizes", () => {
    expect(parseTerminalSizeMessage('{"type":"closed","reason":"gone"}')).toBeNull();
    expect(parseTerminalSizeMessage('{"type":"terminal_size","cols":0,"rows":40}')).toBeNull();
    expect(parseTerminalSizeMessage('{"type":"terminal_size","cols":"120","rows":40}')).toBeNull();
    expect(parseTerminalSizeMessage("not json")).toBeNull();
    expect(parseTerminalSizeMessage(new ArrayBuffer(2))).toBeNull();
  });
});
