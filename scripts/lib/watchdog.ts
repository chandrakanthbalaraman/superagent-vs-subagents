import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type WorkerState = "running" | "finished";
export type WatchdogFlag = "silent" | "stuck" | "looping";

export type WatchdogFinding = {
  ticketId: string;
  flags: WatchdogFlag[];
  details: string;
};

const LOOP_REPEAT = 8;
const LOOP_TAIL = 80;

export function inspectWorker(input: {
  ticketId: string;
  state: WorkerState;
  nowMs: number;
  staleMs: number;
  heartbeatMs: number | null;
  lastCommitMs: number | null;
  logText: string;
}): WatchdogFinding | null {
  if (input.state !== "running") {
    return null;
  }

  const flags: WatchdogFlag[] = [];
  const heartbeatStale = input.heartbeatMs === null || input.nowMs - input.heartbeatMs > input.staleMs;
  const commitStale =
    input.lastCommitMs !== null && input.nowMs - input.lastCommitMs > input.staleMs;

  if (heartbeatStale) {
    flags.push("silent");
  }
  if (heartbeatStale && commitStale) {
    flags.push("stuck");
  }
  if (isLooping(input.logText)) {
    flags.push("looping");
  }
  if (flags.length === 0) {
    return null;
  }

  return {
    ticketId: input.ticketId,
    flags,
    details: describe(flags, input),
  };
}

export function scanRunDirectory(input: { runDir: string; nowMs: number; staleMs: number }): WatchdogFinding[] {
  if (!existsSync(input.runDir)) {
    throw new Error(`Run directory does not exist: ${input.runDir}`);
  }
  const findings: WatchdogFinding[] = [];
  for (const entry of readdirSync(input.runDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dir = path.join(input.runDir, entry.name);
    const statusPath = path.join(dir, "status.json");
    if (!existsSync(statusPath)) {
      continue;
    }
    const status = JSON.parse(readFileSync(statusPath, "utf8")) as {
      ticketId?: string;
      state?: string;
      worktree?: string;
    };
    const state = parseState(status.state);
    const finding = inspectWorker({
      ticketId: status.ticketId ?? entry.name,
      state,
      nowMs: input.nowMs,
      staleMs: input.staleMs,
      heartbeatMs: readHeartbeatMs(path.join(dir, "heartbeat.json")),
      lastCommitMs: readLastCommitMs(status.worktree),
      logText: readOptional(path.join(dir, "worker.log")),
    });
    if (finding !== null) {
      findings.push(finding);
    }
  }
  return findings;
}

export function isLooping(logText: string): boolean {
  const lines = logText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const counts = new Map<string, number>();
  for (const line of lines.slice(-LOOP_TAIL)) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count >= LOOP_REPEAT) {
      return true;
    }
  }
  return false;
}

function describe(
  flags: WatchdogFlag[],
  input: { heartbeatMs: number | null; lastCommitMs: number | null },
): string {
  const parts = flags.map((flag) => {
    switch (flag) {
      case "silent":
        return input.heartbeatMs === null ? "no heartbeat" : "heartbeat is stale";
      case "stuck":
        return "heartbeat is stale and the worktree has no recent commit";
      case "looping":
        return `the same log line appears at least ${LOOP_REPEAT} times`;
      default: {
        const unexpected: never = flag;
        return unexpected;
      }
    }
  });
  return parts.join("; ");
}

function parseState(value: string | undefined): WorkerState {
  switch (value) {
    case "running":
    case "finished":
      return value;
    default:
      throw new Error(`Worker status.state must be running or finished, got "${value ?? ""}".`);
  }
}

function readHeartbeatMs(file: string): number | null {
  if (!existsSync(file)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { updatedAt?: string };
    if (typeof parsed.updatedAt === "string") {
      const ms = Date.parse(parsed.updatedAt);
      if (!Number.isNaN(ms)) {
        return ms;
      }
    }
  } catch {
    // Fall through to the file's modification time.
  }
  return statSync(file).mtimeMs;
}

function readLastCommitMs(worktree: string | undefined): number | null {
  if (worktree === undefined || !existsSync(worktree)) {
    return null;
  }
  try {
    const output = execFileSync("git", ["-C", worktree, "log", "-1", "--format=%ct"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const seconds = Number(output);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  } catch {
    return null;
  }
}

function readOptional(file: string): string {
  if (!existsSync(file)) {
    return "";
  }
  return readFileSync(file, "utf8");
}
