import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Guards the touch-target contract from the spec: primary mobile controls must
 * be at least 40 CSS pixels at the default scale. The values live in CSS, so the
 * test reads the stylesheet instead of duplicating the numbers.
 */
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

function basePx(variable: string): number {
  const match = css.match(new RegExp(`--${variable}:\\s*calc\\((\\d+)px`));
  if (!match) {
    throw new Error(`missing CSS variable: --${variable}`);
  }
  return Number(match[1]);
}

describe("mobile dock metrics", () => {
  it("keeps primary touch targets at or above 40px", () => {
    expect(basePx("mobile-key-height")).toBeGreaterThanOrEqual(40);
    expect(basePx("mobile-key-min-width")).toBeGreaterThanOrEqual(40);
    expect(basePx("mobile-key-icon-width")).toBeGreaterThanOrEqual(40);
    expect(basePx("mobile-input-row-height")).toBeGreaterThanOrEqual(40);
    expect(basePx("mobile-send-width")).toBeGreaterThanOrEqual(40);
  });

  it("keeps at least a 4px gap between adjacent controls", () => {
    expect(basePx("mobile-control-gap")).toBeGreaterThanOrEqual(4);
  });

  it("reserves the soft-keyboard inset in the dock padding", () => {
    expect(css).toContain("var(--keyboard-inset, 0px)");
  });
});
