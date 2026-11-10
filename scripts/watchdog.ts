import { writeFile } from "node:fs/promises";
import path from "node:path";
import { flagString, parseFlags, requirePositiveInt } from "./lib/args.js";
import { scanRunDirectory } from "./lib/watchdog.js";

const ALLOWED = new Set(["--help", "--runs", "--stale-seconds", "--stdout-only"]);

function help(): string {
  return [
    "Flag running workers that look silent, stuck, or looping.",
    "",
    "Usage: tsx scripts/watchdog.ts --runs runs/<stamp> [--stale-seconds 300]",
    "",
    "Reads each ticket directory's status.json, heartbeat.json, and worker.log.",
    "A running worker is silent when the heartbeat is missing or older than the threshold.",
    "It is also stuck when the worktree's latest commit is older than the threshold.",
    "It is looping when one log line repeats 8 times in the last 80 lines.",
    "Finished workers are ignored. This command does not edit the repo.",
  ].join("\n");
}

const flags = parseFlags(process.argv.slice(2), ALLOWED);
if (flags.has("--help")) {
  process.stdout.write(`${help()}\n`);
  process.exit(0);
}

const runs = flagString(flags, "--runs");
if (runs === undefined) {
  process.stderr.write("Pass --runs runs/<stamp>.\n");
  process.exit(1);
}

const staleSeconds = requirePositiveInt(flagString(flags, "--stale-seconds") ?? "300", "--stale-seconds");
try {
  const findings = scanRunDirectory({
    runDir: path.resolve(runs),
    nowMs: Date.now(),
    staleMs: staleSeconds * 1000,
  });
  const body = `${JSON.stringify(findings, null, 2)}\n`;
  process.stdout.write(body);
  if (!flags.has("--stdout-only")) {
    await writeFile(path.join(path.resolve(runs), "watchdog-report.json"), body);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
