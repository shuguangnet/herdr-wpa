import { describe, expect, it } from "vitest";

import { terminalSocketUrl } from "./TerminalView";

const wsUrl = (path: string, query?: URLSearchParams) =>
  `ws://bridge${path}${query ? `?${query.toString()}` : ""}`;
const size = { cols: 40, rows: 20 };

describe("terminalSocketUrl", () => {
  it("asks the bridge to clamp to Herdr's size by default", () => {
    const url = new URL(terminalSocketUrl(wsUrl, "term-1", size, 16, true));
    expect(url.searchParams.get("cols")).toBe("40");
    expect(url.searchParams.get("rows")).toBe("20");
    expect(url.searchParams.get("browser_size")).toBeNull();
    expect(url.searchParams.get("output_encoding")).toBe("gzip");
  });

  it("opts into browser-owned sizing explicitly", () => {
    const url = new URL(terminalSocketUrl(wsUrl, "term-1", size, 16, false, true));
    expect(url.searchParams.get("browser_size")).toBe("1");
    expect(url.searchParams.get("output_encoding")).toBeNull();
  });
});
