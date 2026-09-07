/**
 * Deterministic threshold constants for advanced anomaly detection.
 * All thresholds are centralized here and kept objective and neutral.
 */

// Time Discrepancy (difference between manual time entry and measured active computer time)
export const TIME_DISCREPANCY_MIN_DIFF_MINUTES = 90; // Absolute difference >= 90 min required to flag
export const TIME_DISCREPANCY_LOW_MINUTES = 90;
export const TIME_DISCREPANCY_MEDIUM_MINUTES = 180; // 3 hours
export const TIME_DISCREPANCY_HIGH_MINUTES = 300; // 5 hours

// Project Mismatch (manual entry for Project A while confirmed mapped activity on Project B)
export const PROJECT_MISMATCH_MIN_OVERLAP_SECONDS = 1800; // 30 minutes minimum temporal overlap
export const PROJECT_MISMATCH_LOW_SECONDS = 1800; // 30 min
export const PROJECT_MISMATCH_MEDIUM_SECONDS = 3600; // 1 hour
export const PROJECT_MISMATCH_HIGH_SECONDS = 7200; // 2 hours

// Idle Spike (evaluated during observed computer time: idle / (active + idle))
export const IDLE_SPIKE_RATIO_THRESHOLD = 0.40; // >= 40% idle
export const IDLE_SPIKE_MIN_IDLE_SECONDS = 5400; // >= 90 minutes total idle
export const IDLE_SPIKE_MIN_OBSERVED_SECONDS = 7200; // >= 2 hours total observed time (active + idle)
