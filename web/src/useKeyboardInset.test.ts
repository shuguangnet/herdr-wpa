import { describe, expect, it } from "vitest";

import { keyboardInsetFor } from "./useKeyboardInset";

describe("keyboardInsetFor", () => {
  it("is zero when the layout viewport already shrank", () => {
    expect(
      keyboardInsetFor({ innerHeight: 500, viewportHeight: 500, viewportOffsetTop: 0 }),
    ).toBe(0);
  });

  it("measures the visual viewport gap on iOS Safari", () => {
    expect(
      keyboardInsetFor({ innerHeight: 800, viewportHeight: 500, viewportOffsetTop: 0 }),
    ).toBe(300);
    expect(
      keyboardInsetFor({ innerHeight: 800, viewportHeight: 500, viewportOffsetTop: 20 }),
    ).toBe(280);
  });

  it("never reports a negative inset", () => {
    expect(
      keyboardInsetFor({ innerHeight: 400, viewportHeight: 600, viewportOffsetTop: 0 }),
    ).toBe(0);
    expect(
      keyboardInsetFor({ innerHeight: Number.NaN, viewportHeight: 600, viewportOffsetTop: 0 }),
    ).toBe(0);
  });

  it("rounds fractional viewport heights", () => {
    expect(
      keyboardInsetFor({ innerHeight: 800, viewportHeight: 500.6, viewportOffsetTop: 0 }),
    ).toBe(299);
  });
});
