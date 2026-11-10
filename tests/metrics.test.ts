import { describe, expect, it } from "vitest";
import { countDelegations, readResultMeta } from "../scripts/lib/delegations.js";
import { nearestRankPercentile, summarizeTimings } from "../scripts/lib/metrics.js";

describe("metrics", () => {
  it("uses nearest-rank p50 and reports the slowest ticket", () => {
    expect(nearestRankPercentile([30, 10, 20], 50)).toBe(20);
    expect(nearestRankPercentile([10, 20, 30, 40], 50)).toBe(20);
    expect(
      summarizeTimings([
        { id: "001-search", wallClockMs: 300 },
        { id: "002-favorites", wallClockMs: 100 },
        { id: "003-tags", wallClockMs: 200 },
      ]),
    ).toEqual({
      count: 3,
      totalMs: 600,
      p50Ms: 200,
      slowestMs: 300,
      slowestId: "001-search",
    });
  });

  it("does not invent a percentile when nothing was measured", () => {
    expect(summarizeTimings([])).toEqual({
      count: 0,
      totalMs: null,
      p50Ms: null,
      slowestMs: null,
      slowestId: null,
    });
  });

  it("counts Agent tool calls and reads cost only when the result event has it", () => {
    const stream = [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name: "Agent", id: "a" }, { type: "tool_use", name: "Read", id: "b" }],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "tool_use", name: "Agent", id: "c" }] },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        result: "done",
        total_cost_usd: 0.42,
        session_id: "sess-9",
        usage: { input_tokens: 11, output_tokens: 7 },
      }),
    ].join("\n");

    expect(countDelegations(stream)).toBe(2);
    expect(readResultMeta(stream)).toEqual({
      sessionId: "sess-9",
      totalCostUsd: 0.42,
      usage: { input_tokens: 11, output_tokens: 7 },
    });
  });

  it("leaves cost empty when the result event does not include it", () => {
    const stream = JSON.stringify({ type: "result", result: "ok" });
    expect(readResultMeta(stream)).toEqual({
      sessionId: null,
      totalCostUsd: null,
      usage: null,
    });
  });
});
