import { beforeEach, describe, expect, it } from "vitest";

import { __resetBusyForTest, getBusy, trackBusy } from "./busy";

beforeEach(() => {
  __resetBusyForTest();
});

describe("busy tracker", () => {
  it("nests concurrent writes", () => {
    const first = trackBusy();
    const second = trackBusy();
    expect(getBusy()).toBe(true);
    first();
    expect(getBusy()).toBe(true);
    second();
    expect(getBusy()).toBe(false);
  });

  it("ignores double release", () => {
    const done = trackBusy();
    done();
    done();
    expect(getBusy()).toBe(false);
  });
});
