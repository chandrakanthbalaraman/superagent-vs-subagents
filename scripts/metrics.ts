import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { flagString, parseFlags } from "./lib/args.js";
import { summarizeTimings } from "./lib/metrics.js";

const ALLOWED = new Set(["--help", "--timings"]);

function help(): string {
  return [
    "Summarize a timings.json file written by a real run.",
    "",
    "Usage: tsx scripts/metrics.ts [--timings runs/<stamp>/timings.json]",
    "",
    "Prints wall-clock sum, nearest-rank p50, and the slowest ticket.",
    "Null measurements are printed as 'not measured'. This command never fills results/results.md.",
  ].join("\n");
}

const flags = parseFlags(process.argv.slice(2), ALLOWED);
if (flags.has("--help")) {
  process.stdout.write(`${help()}\n`);
  process.exit(0);
}

const timingsPath = flagString(flags, "--timings") ?? newestTimings(process.cwd());
if (timingsPath === null || !existsSync(timingsPath)) {
  process.stdout.write("No timings file found. Nothing was measured.\n");
  process.exit(0);
}

const parsed: unknown = JSON.parse(readFileSync(timingsPath, "utf8"));
process.stdout.write(formatReport(timingsPath, parsed));

function newestTimings(repoRoot: string): string | null {
  const runsDir = path.join(repoRoot, "runs");
  if (!existsSync(runsDir)) {
    return null;
  }
  const candidates: string[] = [];
  for (const entry of readdirSync(runsDir)) {
    const direct = path.join(runsDir, entry, "timings.json");
    if (existsSync(direct)) {
      candidates.push(direct);
    }
    const nestedDir = path.join(runsDir, entry);
    if (!existsSync(nestedDir)) {
      continue;
    }
    try {
      for (const child of readdirSync(nestedDir)) {
        const nested = path.join(nestedDir, child, "timings.json");
        if (existsSync(nested)) {
          candidates.push(nested);
        }
      }
    } catch {
      // Not a directory.
    }
  }
  candidates.sort();
  return candidates.at(-1) ?? null;
}

function formatReport(file: string, parsed: unknown): string {
  const lines = [`Timings file: ${file}`];
  if (!isRecord(parsed) || !Array.isArray(parsed.tickets)) {
    lines.push("The file has no ticket timings.");
    return `${lines.join("\n")}\n`;
  }
  const tickets = parsed.tickets.flatMap((ticket) => {
    if (!isRecord(ticket) || typeof ticket.id !== "string" || typeof ticket.wallClockMs !== "number") {
      return [];
    }
    return [{ id: ticket.id, wallClockMs: ticket.wallClockMs }];
  });
  const summary = summarizeTimings(tickets);
  lines.push(`tickets: ${summary.count}`);
  lines.push(`sum of ticket wall clocks (ms): ${show(summary.totalMs)}`);
  lines.push(`p50 wall clock (ms): ${show(summary.p50Ms)}`);
  lines.push(
    summary.slowestId === null
      ? "slowest: not measured"
      : `slowest: ${summary.slowestId} (${summary.slowestMs} ms)`,
  );
  lines.push(`session wall clock (ms): ${show(parsed.wallClockMs)}`);
  for (const ticket of parsed.tickets) {
    if (!isRecord(ticket) || typeof ticket.id !== "string") {
      continue;
    }
    lines.push(
      [
        ticket.id,
        `wall=${show(ticket.wallClockMs)}`,
        `delegations=${show(ticket.delegations)}`,
        `tests=${show(ticket.testsPassing)}`,
        `evalFirstTry=${show(ticket.evalFirstTry)}`,
        `costUsd=${show(ticket.totalCostUsd)}`,
        `usage=${ticket.usage === null || ticket.usage === undefined ? "not measured" : JSON.stringify(ticket.usage)}`,
      ].join(" "),
    );
  }
  lines.push("human interventions: not measured");
  lines.push("planted bug found: not measured");
  return `${lines.join("\n")}\n`;
}

function show(value: unknown): string {
  if (value === null || value === undefined) {
    return "not measured";
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return String(value);
  }
  return "not measured";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
