use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;

/// Lightweight counters that make it possible to tell browser-side jank from
/// bridge-side work (snapshot churn, event fanout) without attaching a profiler.
#[derive(Default)]
pub(crate) struct BridgeMetrics {
    snapshot_requests: AtomicU64,
    snapshot_not_modified: AtomicU64,
    snapshot_bytes: AtomicU64,
    event_broadcasts: AtomicU64,
    event_forwarder_restarts: AtomicU64,
    event_lagged_clients: AtomicU64,
    terminal_output_frames: AtomicU64,
    terminal_output_bytes: AtomicU64,
}

#[derive(Debug, Serialize)]
pub(crate) struct BridgeMetricsSnapshot {
    pub snapshot_requests: u64,
    pub snapshot_not_modified: u64,
    pub snapshot_bytes: u64,
    pub event_broadcasts: u64,
    pub event_forwarder_restarts: u64,
    pub event_lagged_clients: u64,
    pub terminal_output_frames: u64,
    pub terminal_output_bytes: u64,
}

impl BridgeMetrics {
    pub(crate) fn record_snapshot(&self, not_modified: bool, body_bytes: usize) {
        self.snapshot_requests.fetch_add(1, Ordering::Relaxed);
        if not_modified {
            self.snapshot_not_modified.fetch_add(1, Ordering::Relaxed);
        } else {
            self.snapshot_bytes
                .fetch_add(body_bytes as u64, Ordering::Relaxed);
        }
    }

    pub(crate) fn record_event_broadcast(&self) {
        self.event_broadcasts.fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn record_event_forwarder_restart(&self) {
        self.event_forwarder_restarts
            .fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn record_event_lagged_client(&self) {
        self.event_lagged_clients.fetch_add(1, Ordering::Relaxed);
    }

    pub(crate) fn record_terminal_output_frame(&self, bytes: usize) {
        self.terminal_output_frames.fetch_add(1, Ordering::Relaxed);
        self.terminal_output_bytes
            .fetch_add(bytes as u64, Ordering::Relaxed);
    }

    pub(crate) fn snapshot(&self) -> BridgeMetricsSnapshot {
        BridgeMetricsSnapshot {
            snapshot_requests: self.snapshot_requests.load(Ordering::Relaxed),
            snapshot_not_modified: self.snapshot_not_modified.load(Ordering::Relaxed),
            snapshot_bytes: self.snapshot_bytes.load(Ordering::Relaxed),
            event_broadcasts: self.event_broadcasts.load(Ordering::Relaxed),
            event_forwarder_restarts: self.event_forwarder_restarts.load(Ordering::Relaxed),
            event_lagged_clients: self.event_lagged_clients.load(Ordering::Relaxed),
            terminal_output_frames: self.terminal_output_frames.load(Ordering::Relaxed),
            terminal_output_bytes: self.terminal_output_bytes.load(Ordering::Relaxed),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_snapshot_and_event_traffic() {
        let metrics = BridgeMetrics::default();
        metrics.record_snapshot(false, 1024);
        metrics.record_snapshot(true, 0);
        metrics.record_event_broadcast();
        metrics.record_event_forwarder_restart();
        metrics.record_event_lagged_client();
        metrics.record_terminal_output_frame(16);

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.snapshot_requests, 2);
        assert_eq!(snapshot.snapshot_not_modified, 1);
        assert_eq!(snapshot.snapshot_bytes, 1024);
        assert_eq!(snapshot.event_broadcasts, 1);
        assert_eq!(snapshot.event_forwarder_restarts, 1);
        assert_eq!(snapshot.event_lagged_clients, 1);
        assert_eq!(snapshot.terminal_output_frames, 1);
        assert_eq!(snapshot.terminal_output_bytes, 16);
    }
}
