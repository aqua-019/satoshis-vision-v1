/* Fixture specification for monerofail-health.json
   These expected values must match exactly for the gate to pass.
   They are validated against the parsed fixture data. */

export const EXPECTED = {
  // Transport split
  transports: {
    clear: 17,
    tor: 4,
    i2p: 3,
    total: 24,
  },

  // Node health counts
  counts: {
    seen: 24,
    reachable: 23,
    excluded: 1, // clear-malformed: missing 'available' field
    unknownHeight: 2, // available but missing/invalid height: clear-missing-height, clear-zero-height
  },

  // Height analysis
  height: {
    mode: 3729557,
    modeCount: 8,
    totalClusters: 7,
    laggingCount: 4, // nodes with lag > 2
    laggingClusters: [
      { height: 3729554, count: 1, lag: 3 },
      { height: 3729553, count: 2, lag: 4 },
      { height: 3729552, count: 1, lag: 5 },
    ],
  },

  // Availability distribution over 4 buckets (skips nodes with empty checks)
  availability: [
    { from: 0, to: 0.25, count: 1 },
    { from: 0.25, to: 0.5, count: 0 },
    { from: 0.5, to: 0.75, count: 0 },
    { from: 0.75, to: 1, count: 22 },
  ],

  // Maximum (newest) datetime_checked across all nodes (web_compatible is ignored)
  sampledAt: '2026-08-03T12:05:45Z',

  // Partial flag: web_compatible section present but ignored
  partial: false,
};
