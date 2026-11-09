import { describe, expect, it } from "vitest";

import { isCompactLayoutSize } from "./layout";

describe("isCompactLayoutSize", () => {
  it("treats phones as single column in both orientations", () => {
    expect(isCompactLayoutSize(390, 844)).toBe(true);
    expect(isCompactLayoutSize(844, 390)).toBe(true);
    expect(isCompactLayoutSize(430, 932)).toBe(true);
  });

  it("gives tablets two columns in both orientations", () => {
    expect(isCompactLayoutSize(768, 1024)).toBe(false);
    expect(isCompactLayoutSize(1024, 768)).toBe(false);
    expect(isCompactLayoutSize(820, 1180)).toBe(false);
  });

  it("keeps desktop two-column even on a short window", () => {
    expect(isCompactLayoutSize(1280, 400)).toBe(false);
    expect(isCompactLayoutSize(1100, 500)).toBe(false);
  });
});
