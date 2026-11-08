export type SnapshotRefreshControllerOptions<TSnapshot> = {
  fetchSnapshot: () => Promise<TSnapshot>;
  applySnapshot: (snapshot: TSnapshot, refreshGeneration: number) => void;
  onError: (error: unknown) => void;
  isCurrent: () => boolean;
  getGeneration: () => number;
  getBarrierGeneration: () => number;
};

export type SnapshotRefreshSchedulerTimers = {
  schedule: (callback: () => void, delayMs: number) => number;
  cancel: (handle: number) => void;
};

/**
 * Coalesces bridge event traffic into at most one trailing snapshot refresh.
 * Structural event bursts (agent status flaps, layout churn) previously issued
 * one full `/api/snapshot` request per event.
 */
export function createSnapshotRefreshScheduler(
  request: () => void,
  debounceMs: number,
  timers: SnapshotRefreshSchedulerTimers,
) {
  let pending: number | null = null;

  const cancelPending = () => {
    if (pending !== null) {
      timers.cancel(pending);
      pending = null;
    }
  };

  return {
    /** Schedules a trailing refresh, keeping any refresh already scheduled. */
    soon() {
      if (pending !== null) {
        return;
      }
      pending = timers.schedule(() => {
        pending = null;
        request();
      }, debounceMs);
    },
    /** Refreshes immediately, replacing any scheduled trailing refresh. */
    now() {
      cancelPending();
      request();
    },
    dispose: cancelPending,
  };
}

export function createSnapshotRefreshController<TSnapshot>({
  fetchSnapshot,
  applySnapshot,
  onError,
  isCurrent,
  getGeneration,
  getBarrierGeneration,
}: SnapshotRefreshControllerOptions<TSnapshot>) {
  let refreshInFlight = false;
  let refreshPending = false;

  const runRefresh = () => {
    const refreshGeneration = getGeneration();
    refreshInFlight = true;
    void fetchSnapshot()
      .then((next) => {
        if (!isCurrent()) {
          return;
        }
        if (getBarrierGeneration() > refreshGeneration) {
          refreshPending = true;
          return;
        }
        applySnapshot(next, refreshGeneration);
      })
      .catch((error: unknown) => {
        if (isCurrent()) {
          onError(error);
        }
      })
      .finally(() => {
        refreshInFlight = false;
        if (isCurrent() && refreshPending) {
          refreshPending = false;
          runRefresh();
        }
      });
  };

  return {
    request() {
      if (!isCurrent()) {
        return;
      }
      if (refreshInFlight) {
        refreshPending = true;
        return;
      }
      runRefresh();
    },
  };
}
