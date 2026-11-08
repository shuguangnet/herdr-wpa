import { describe, expect, it } from "vitest";

import { DEFAULT_HAPTICS_ENABLED, parseHapticsEnabled, shouldPulse } from "./useHaptics";

describe("parseHapticsEnabled", () => {
  it("keeps booleans and falls back otherwise", () => {
    expect(parseHapticsEnabled(true)).toBe(true);
    expect(parseHapticsEnabled(false)).toBe(false);
    expect(parseHapticsEnabled("yes")).toBe(DEFAULT_HAPTICS_ENABLED);
    expect(parseHapticsEnabled(null)).toBe(DEFAULT_HAPTICS_ENABLED);
    expect(parseHapticsEnabled(undefined)).toBe(DEFAULT_HAPTICS_ENABLED);
  });
});

describe("shouldPulse", () => {
  it("requires support, opt-in and no reduced-motion preference", () => {
    expect(shouldPulse({ enabled: true, supported: true, reduceMotion: false })).toBe(true);
    expect(shouldPulse({ enabled: false, supported: true, reduceMotion: false })).toBe(false);
    expect(shouldPulse({ enabled: true, supported: false, reduceMotion: false })).toBe(false);
    expect(shouldPulse({ enabled: true, supported: true, reduceMotion: true })).toBe(false);
  });
});
