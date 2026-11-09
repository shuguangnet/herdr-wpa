import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetStatusForTest,
  clearStatus,
  getStatus,
  setStatus,
  subscribeStatus,
  DEFAULT_STATUS_TTL_MS,
} from "./status";

beforeEach(() => {
  vi.useFakeTimers();
  __resetStatusForTest();
});

afterEach(() => {
  clearStatus();
  vi.useRealTimers();
});

describe("status channel", () => {
  it("keeps the latest message", () => {
    setStatus("first");
    setStatus("second", "success");
    expect(getStatus()).toMatchObject({ text: "second", tone: "success" });
  });

  it("auto-dismisses non-errors", () => {
    setStatus("saved");
    expect(getStatus()).not.toBeNull();
    vi.advanceTimersByTime(DEFAULT_STATUS_TTL_MS);
    expect(getStatus()).toBeNull();
  });

  it("keeps errors until dismissed", () => {
    setStatus("bridge failed", "error");
    vi.advanceTimersByTime(DEFAULT_STATUS_TTL_MS * 10);
    expect(getStatus()?.text).toBe("bridge failed");
    clearStatus();
    expect(getStatus()).toBeNull();
  });

  it("honors an explicit ttl and zero ttl keeps it", () => {
    setStatus("brief", "info", 500);
    vi.advanceTimersByTime(500);
    expect(getStatus()).toBeNull();
    setStatus("sticky", "info", null);
    vi.advanceTimersByTime(10_000);
    expect(getStatus()?.text).toBe("sticky");
  });

  it("notifies subscribers", () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeStatus(() => {
      seen.push(getStatus()?.text ?? null);
    });
    setStatus("hello");
    unsubscribe();
    setStatus("ignored");
    expect(seen).toEqual(["hello"]);
  });
});
