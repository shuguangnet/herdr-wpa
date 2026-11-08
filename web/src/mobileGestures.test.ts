/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  GESTURE_DIRECTION_THRESHOLD_PX,
  GESTURE_MIN_SWIPE_PX,
  GESTURE_PULL_REFRESH_PX,
  isGestureExcludedTarget,
  parseMobileGesturesEnabled,
  resolveGesture,
} from "./mobileGestures";

const base = { width: 390, edgeStart: false, atTop: false };

describe("resolveGesture", () => {
  it("stays pending below the direction threshold", () => {
    expect(resolveGesture({ ...base, dx: 6, dy: 2 })).toBe("pending");
    expect(resolveGesture({ ...base, dx: 0, dy: GESTURE_DIRECTION_THRESHOLD_PX - 1 })).toBe(
      "pending",
    );
  });

  it("swipes to the next pane past the screen-relative threshold", () => {
    expect(resolveGesture({ ...base, dx: -60, dy: 4 })).toBe("swipe-left");
    expect(resolveGesture({ ...base, dx: 60, dy: 4 })).toBe("swipe-right");
    expect(resolveGesture({ ...base, dx: -40, dy: 4 })).toBe("none");
  });

  it("uses the larger of 48px and 15% of the screen width", () => {
    const wide = { ...base, width: 1000 };
    expect(resolveGesture({ ...wide, dx: -60, dy: 0 })).toBe("none");
    expect(resolveGesture({ ...wide, dx: -160, dy: 0 })).toBe("swipe-left");
  });

  it("turns a left-edge right swipe into back", () => {
    expect(
      resolveGesture({ ...base, edgeStart: true, dx: GESTURE_MIN_SWIPE_PX, dy: 0 }),
    ).toBe("back");
    expect(resolveGesture({ ...base, edgeStart: false, dx: 60, dy: 0 })).toBe("swipe-right");
  });

  it("pulls to refresh only from the top", () => {
    expect(resolveGesture({ ...base, atTop: true, dx: 2, dy: GESTURE_PULL_REFRESH_PX })).toBe(
      "pull-refresh",
    );
    expect(resolveGesture({ ...base, atTop: false, dx: 2, dy: 120 })).toBe("none");
  });
});

describe("isGestureExcludedTarget", () => {
  it("excludes controls, overlays and terminal canvases", () => {
    const input = document.createElement("input");
    const key = document.createElement("button");
    key.className = "term-key";
    const canvas = document.createElement("canvas");
    const plain = document.createElement("div");
    const ignored = document.createElement("div");
    ignored.dataset.gestureIgnore = "true";

    expect(isGestureExcludedTarget(input)).toBe(true);
    expect(isGestureExcludedTarget(key)).toBe(true);
    expect(isGestureExcludedTarget(canvas)).toBe(true);
    expect(isGestureExcludedTarget(ignored)).toBe(true);
    expect(isGestureExcludedTarget(plain)).toBe(false);
    expect(isGestureExcludedTarget(null)).toBe(false);
  });
});

describe("parseMobileGesturesEnabled", () => {
  it("keeps booleans and defaults otherwise", () => {
    expect(parseMobileGesturesEnabled(false)).toBe(false);
    expect(parseMobileGesturesEnabled(true)).toBe(true);
    expect(parseMobileGesturesEnabled("no")).toBe(true);
    expect(parseMobileGesturesEnabled(undefined)).toBe(true);
  });
});
