import { describe, expect, it } from "vitest";

import { isIosDevice, isIosInstallable } from "./useInstallOffer";

describe("install offer helpers", () => {
  it("detects iOS devices", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
  });

  it("shows the iOS hint only before install with no prompt", () => {
    const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
    expect(isIosInstallable(ios, false, false)).toBe(true);
    expect(isIosInstallable(ios, true, false)).toBe(false);
    expect(isIosInstallable(ios, false, true)).toBe(false);
    expect(isIosInstallable("Mozilla/5.0 (Linux; Android 14)", false, false)).toBe(false);
  });
});
