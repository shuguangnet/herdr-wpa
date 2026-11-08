import { describe, expect, it } from "vitest";
import { createSnapshotRefreshController, createSnapshotRefreshScheduler } from "./refreshCoordinator";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

const flushPromises = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const flushRefresh = async () => {
  await flushPromises();
  await flushPromises();
};

describe("createSnapshotRefreshController", () => {
  it("coalesces requests while a refresh is in flight", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const fetches = [first, second];
    const applied: Array<{ snapshot: string; generation: number }> = [];
    const controller = createSnapshotRefreshController({
      fetchSnapshot: () => fetches.shift()?.promise ?? Promise.reject(new Error("unexpected fetch")),
      applySnapshot: (snapshot, generation) => applied.push({ snapshot, generation }),
      onError: () => {},
      isCurrent: () => true,
      getGeneration: () => 0,
      getBarrierGeneration: () => 0,
    });

    controller.request();
    controller.request();
    controller.request();
    expect(fetches).toHaveLength(1);

    first.resolve("first");
    await flushRefresh();
    expect(applied).toEqual([{ snapshot: "first", generation: 0 }]);
    expect(fetches).toHaveLength(0);

    second.resolve("second");
    await flushRefresh();
    expect(applied).toEqual([
      { snapshot: "first", generation: 0 },
      { snapshot: "second", generation: 0 },
    ]);
  });

  it("discards snapshots older than the resync barrier and runs one follow-up refresh", async () => {
    let generation = 0;
    let barrierGeneration = 0;
    const first = deferred<string>();
    const second = deferred<string>();
    const fetches = [first, second];
    const applied: Array<{ snapshot: string; generation: number }> = [];
    const controller = createSnapshotRefreshController({
      fetchSnapshot: () => fetches.shift()?.promise ?? Promise.reject(new Error("unexpected fetch")),
      applySnapshot: (snapshot, refreshGeneration) =>
        applied.push({ snapshot, generation: refreshGeneration }),
      onError: () => {},
      isCurrent: () => true,
      getGeneration: () => generation,
      getBarrierGeneration: () => barrierGeneration,
    });

    controller.request();
    generation = 1;
    barrierGeneration = 1;
    first.resolve("stale");
    await flushRefresh();

    expect(applied).toEqual([]);
    expect(fetches).toHaveLength(0);

    second.resolve("fresh");
    await flushRefresh();
    expect(applied).toEqual([{ snapshot: "fresh", generation: 1 }]);
  });

  it("ignores completions after the connection is no longer current", async () => {
    let current = true;
    const first = deferred<string>();
    const applied: string[] = [];
    const controller = createSnapshotRefreshController({
      fetchSnapshot: () => first.promise,
      applySnapshot: (snapshot) => applied.push(snapshot),
      onError: () => {},
      isCurrent: () => current,
      getGeneration: () => 0,
      getBarrierGeneration: () => 0,
    });

    controller.request();
    current = false;
    first.resolve("stale");
    await flushRefresh();

    expect(applied).toEqual([]);
  });
});

function manualTimers() {
  let nextHandle = 1;
  const pending = new Map<number, () => void>();
  return {
    schedule: (callback: () => void) => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    },
    cancel: (handle: number) => {
      pending.delete(handle);
    },
    runAll: () => {
      for (const [handle, callback] of [...pending]) {
        pending.delete(handle);
        callback();
      }
    },
    pendingCount: () => pending.size,
  };
}

describe("createSnapshotRefreshScheduler", () => {
  it("coalesces a burst of events into one trailing refresh", () => {
    const timers = manualTimers();
    let refreshes = 0;
    const scheduler = createSnapshotRefreshScheduler(() => {
      refreshes += 1;
    }, 150, timers);

    scheduler.soon();
    scheduler.soon();
    scheduler.soon();
    expect(refreshes).toBe(0);
    expect(timers.pendingCount()).toBe(1);

    timers.runAll();
    expect(refreshes).toBe(1);
    expect(timers.pendingCount()).toBe(0);
  });

  it("runs immediately and cancels the scheduled refresh", () => {
    const timers = manualTimers();
    let refreshes = 0;
    const scheduler = createSnapshotRefreshScheduler(() => {
      refreshes += 1;
    }, 150, timers);

    scheduler.soon();
    scheduler.now();
    expect(refreshes).toBe(1);
    expect(timers.pendingCount()).toBe(0);

    timers.runAll();
    expect(refreshes).toBe(1);
  });

  it("schedules again after the trailing refresh ran", () => {
    const timers = manualTimers();
    let refreshes = 0;
    const scheduler = createSnapshotRefreshScheduler(() => {
      refreshes += 1;
    }, 150, timers);

    scheduler.soon();
    timers.runAll();
    scheduler.soon();
    timers.runAll();
    expect(refreshes).toBe(2);
  });

  it("drops a pending refresh on dispose", () => {
    const timers = manualTimers();
    let refreshes = 0;
    const scheduler = createSnapshotRefreshScheduler(() => {
      refreshes += 1;
    }, 150, timers);

    scheduler.soon();
    scheduler.dispose();
    timers.runAll();
    expect(refreshes).toBe(0);
  });
});
