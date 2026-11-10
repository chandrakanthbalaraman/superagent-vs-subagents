import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectWorker, scanRunDirectory } from "../scripts/lib/watchdog.js";

const minute = 60_000;

describe("watchdog", () => {
  it("flags a running worker with no heartbeat as silent", () => {
    const finding = inspectWorker({
      ticketId: "001-search",
      state: "running",
      nowMs: 10 * minute,
      staleMs: 5 * minute,
      heartbeatMs: null,
      lastCommitMs: 9 * minute,
      logText: "reading spec\n",
    });
    expect(finding?.flags).toEqual(["silent"]);
  });

  it("flags a stale heartbeat and a stale commit as silent and stuck", () => {
    const finding = inspectWorker({
      ticketId: "002-favorites",
      state: "running",
      nowMs: 20 * minute,
      staleMs: 5 * minute,
      heartbeatMs: 1 * minute,
      lastCommitMs: 1 * minute,
      logText: "editing\n",
    });
    expect(finding?.flags).toEqual(["silent", "stuck"]);
  });

  it("does not flag a fresh heartbeat that has not committed yet", () => {
    const finding = inspectWorker({
      ticketId: "003-tags",
      state: "running",
      nowMs: 10 * minute,
      staleMs: 5 * minute,
      heartbeatMs: 9 * minute,
      lastCommitMs: null,
      logText: "still reading\n",
    });
    expect(finding).toBeNull();
  });

  it("flags a repeated log line as looping", () => {
    const line = "running npm test\n".repeat(8);
    const finding = inspectWorker({
      ticketId: "004-pagination",
      state: "running",
      nowMs: 10 * minute,
      staleMs: 5 * minute,
      heartbeatMs: 9 * minute,
      lastCommitMs: 9 * minute,
      logText: line,
    });
    expect(finding?.flags).toEqual(["looping"]);
  });

  it("reads a run directory and flags a stale heartbeat", async () => {
    const runDir = await mkdtemp(path.join(tmpdir(), "watchdog-"));
    const ticketDir = path.join(runDir, "001-search");
    await mkdir(ticketDir);
    await writeFile(
      path.join(ticketDir, "status.json"),
      JSON.stringify({ ticketId: "001-search", state: "running", worktree: "/missing/worktree" }),
    );
    await writeFile(
      path.join(ticketDir, "heartbeat.json"),
      JSON.stringify({ updatedAt: "2020-01-01T00:00:00.000Z", note: "old" }),
    );
    const findings = scanRunDirectory({
      runDir,
      nowMs: Date.parse("2020-01-01T00:10:00.000Z"),
      staleMs: 60_000,
    });
    expect(findings.map((finding) => finding.flags)).toEqual([["silent"]]);
  });

  it("ignores a worker that has already finished", () => {
    const finding = inspectWorker({
      ticketId: "005-input-validation",
      state: "finished",
      nowMs: 50 * minute,
      staleMs: 5 * minute,
      heartbeatMs: 1 * minute,
      lastCommitMs: 1 * minute,
      logText: "done\n".repeat(10),
    });
    expect(finding).toBeNull();
  });
});
