import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { flagString, parseFlags } from "./args.js";
import { parseBoard } from "./board.js";
import { buildClaudeArgs } from "./claude-command.js";
import { countDelegations, readResultMeta } from "./delegations.js";
import { readLaunchOptions } from "./launch-options.js";
import { renderSubagentsDryRun, type SubagentMode } from "./render-subagents.js";
import { buildPlainSessionPrompt, buildTeamSessionPrompt } from "./role-prompts.js";
import { runCommand } from "./spawn.js";
import { blankTicket, type RunTimings } from "./timings.js";
import { commandExists, MISSING_CLAUDE } from "./which.js";

const ALLOWED = new Set([
  "--help",
  "--dry-run",
  "--mode",
  "--permission-mode",
  "--max-turns",
  "--max-budget-usd",
  "--max-parallel",
  "--allowed-tools",
  "--permission-prompts",
  "--forward-subagent-text",
  "--bare",
]);

export function subagentsHelp(): string {
  return [
    "Run the ready tickets in one Claude Code session.",
    "",
    "Usage: tsx scripts/run-subagents.ts [--mode plain|team] [--dry-run]",
    "",
    "  --mode plain   One session. It may delegate. This is the default.",
    "  --mode team    Same session, told to use planner, implementer, test-writer, and reviewer.",
    "  --mode both    Dry-run only. A real run needs two clones.",
    "  --dry-run      Print the claude command. Start nothing.",
    "  --bare         Pass Claude Code's --bare flag (skips project agents). B1 control.",
    "",
    "Other flags match the super-agent runner. See scripts/run-superagent.ts --help.",
    "https://code.claude.com/docs/en/cli-reference",
  ].join("\n");
}

export async function executeSubagents(argv: string[], repoRoot = process.cwd()): Promise<number> {
  const flags = parseFlags(argv, ALLOWED);
  const launch = readLaunchOptions(flags);
  if (launch.help) {
    process.stdout.write(`${subagentsHelp()}\n`);
    return 0;
  }
  const mode = parseMode(flagString(flags, "--mode") ?? "plain");
  const tickets = parseBoard(await readFile(path.join(repoRoot, "specs/board.md"), "utf8"));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  if (launch.dryRun) {
    process.stdout.write(`${renderSubagentsDryRun({ repoRoot, tickets, launch, mode, stamp })}\n`);
    return 0;
  }
  if (mode === "both") {
    process.stderr.write("Refusing to run plain and team in one checkout. Pass --mode plain or --mode team.\n");
    return 1;
  }
  if (!(await commandExists("claude"))) {
    process.stderr.write(MISSING_CLAUDE);
    return 1;
  }

  const dir = path.join(repoRoot, "runs", stamp, `subagents-${mode}`);
  await mkdir(dir, { recursive: true });
  const reportPath = path.join(dir, "report.md");
  const prompt =
    mode === "plain" ? buildPlainSessionPrompt(tickets, reportPath) : buildTeamSessionPrompt(tickets, reportPath);
  const started = Date.now();
  const args = buildClaudeArgs({
    prompt,
    permissionMode: launch.permissionMode,
    maxTurns: launch.maxTurns,
    name: `subagents-${mode}`,
    allowedTools: launch.allowedTools,
    maxBudgetUsd: launch.maxBudgetUsd,
    forwardSubagentText: launch.forwardSubagentText,
    permissionPrompts: launch.permissionPrompts,
    bare: launch.bare,
    appendSystemPromptFile: mode === "team" ? path.join(repoRoot, "subagents/team/orchestrator.md") : undefined,
  });
  const result = await runCommand({
    command: "claude",
    args,
    cwd: repoRoot,
    logPath: path.join(dir, "session.log"),
  });
  const npm = await runCommand({
    command: "npm",
    args: ["test"],
    cwd: repoRoot,
    logPath: path.join(dir, "npm-test.log"),
  });
  const meta = readResultMeta(result.stdout);
  const record = blankTicket("session", Date.now() - started);
  record.claudeExitCode = result.code;
  record.npmTestExitCode = npm.code;
  record.testsPassing = npm.code === 0;
  record.delegations = countDelegations(result.stdout);
  record.sessionId = meta.sessionId;
  record.totalCostUsd = meta.totalCostUsd;
  record.usage = meta.usage;

  const finished = Date.now();
  const timings: RunTimings = {
    setup: `subagents-${mode}`,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    wallClockMs: finished - started,
    tickets: [record],
    humanInterventions: null,
    plantedBugFound: null,
    notes: [
      "Setup B records one session wall clock. Per-ticket times stay empty unless you fill them from the report by hand.",
    ],
  };
  const timingsPath = path.join(dir, "timings.json");
  await writeFile(timingsPath, `${JSON.stringify(timings, null, 2)}\n`);
  process.stdout.write(`Delegations (Agent tool calls in this process): ${record.delegations}\n`);
  process.stdout.write(`Timings written to ${timingsPath}\n`);
  process.stdout.write("Per-ticket wall clocks: not measured\n");
  process.stdout.write("human interventions: not measured\nplanted bug found: not measured\n");
  return result.code === 0 && npm.code === 0 ? 0 : 1;
}

function parseMode(value: string): SubagentMode {
  switch (value) {
    case "plain":
    case "team":
    case "both":
      return value;
    default:
      throw new Error(`--mode must be plain, team, or both. Got "${value}".`);
  }
}
