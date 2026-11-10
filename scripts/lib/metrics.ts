export type TicketTiming = {
  id: string;
  wallClockMs: number;
};

export type TimingSummary = {
  count: number;
  totalMs: number | null;
  p50Ms: number | null;
  slowestMs: number | null;
  slowestId: string | null;
};

/** Nearest-rank percentile. p50 of [10, 20, 30, 40] is 20. */
export function nearestRankPercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    throw new Error("percentile requires at least one value");
  }
  if (percentile <= 0 || percentile > 100) {
    throw new Error("percentile must be greater than 0 and at most 100");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  const value = sorted[rank - 1];
  if (value === undefined) {
    throw new Error("percentile index was out of range");
  }
  return value;
}

export function summarizeTimings(timings: TicketTiming[]): TimingSummary {
  if (timings.length === 0) {
    return { count: 0, totalMs: null, p50Ms: null, slowestMs: null, slowestId: null };
  }
  let slowest = timings[0];
  if (slowest === undefined) {
    return { count: 0, totalMs: null, p50Ms: null, slowestMs: null, slowestId: null };
  }
  let totalMs = 0;
  for (const timing of timings) {
    totalMs += timing.wallClockMs;
    if (timing.wallClockMs > slowest.wallClockMs) {
      slowest = timing;
    }
  }
  return {
    count: timings.length,
    totalMs,
    p50Ms: nearestRankPercentile(
      timings.map((timing) => timing.wallClockMs),
      50,
    ),
    slowestMs: slowest.wallClockMs,
    slowestId: slowest.id,
  };
}
