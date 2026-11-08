import { describe, expect, it } from "vitest";

import { shouldShowMobileHint } from "./mobileHint";

describe("shouldShowMobileHint", () => {
  it("shows once on touch devices", () => {
    expect(shouldShowMobileHint(true, null)).toBe(true);
    expect(shouldShowMobileHint(true, "1")).toBe(false);
  });

  it("never shows on desktop", () => {
    expect(shouldShowMobileHint(false, null)).toBe(false);
  });
});
