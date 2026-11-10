import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { agentBinary } from "./agent-cli.js";
import { buildAgentCommand } from "./agent-command.js";
import { readAgentStream } from "./agent-stream.js";
import { flagString, parseFlags } from "./args.js";
import { parseBoard } from "./board.js";
import { CODEX_PLAIN_DELEGATION_NOTE, CODEX_TEAM_DELEGATION_NOTE, readTextFile } from "./codex-prompt.js";
import { readLaunchOptions } from "./launch-options.js";
import { renderSubagentsDryRun, type SubagentMode } from "./render-subagents.js";
import {
  buildCodexPlainSessionPrompt,
  buildCodexTeamSessionPrompt,
  buildPlainSessionPrompt,
  buildTeamSessionPrompt,
} from "./role-prompts.js";
import { runCommand } from "./spawn.js";
import { blankTicket, type RunTimings } from "./timings.js";
import { commandExists, MISSING_CLAUDE, MISSING_CODEX } from "./which.js";

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
  "--agent-cli",
  "--timeout-seconds",
]);

export function subagentsHelp(): string {
  return [
    "Run the ready tickets in one agent session.",
    "",
    "Usage: tsx scripts/run-subagents.ts [--mode plain|team] [--dry-run]",
    "",
    "  --agent-cli claude|codex   Which CLI to run. Default claude. Env: SUPERAGENT_AGENT_CLI.",
    "  --timeout-seconds <n>      Codex only. Kill the process after n seconds. Default 1800. 0 disables.",
    "  --mode plain   One session. It may delegate. This is the default.",
    "  --mode team    Same session, told to use planner, implementer, test-writer, and reviewer.",
    "  --mode both    Dry-run only. A real run needs two clones.",
    "  --dry-run      Print the agent command. Start nothing.",
    "  --bare         Pass Claude Code's --bare flag (skips project agents). B1 control. Codex ignores it.",
    "",
    "Other flags match the super-agent runner. See scripts/run-superagent.ts --help.",
    "https://code.claude.com/docs/en/cli-reference",
    "https://developers.openai.com/codex/noninteractive",
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
  if (!(await commandExists(agentBinary(launch.agentCli)))) {
    process.stderr.write(launch.agentCli === "codex" ? MISSING_CODEX : MISSING_CLAUDE);
    return 1;
  }

  const dir = path.join(repoRoot, "runs", stamp, `subagents-${mode}`);
  await mkdir(dir, { recursive: true });
  const reportPath = path.join(dir, "report.md");
  const orchestratorPath = path.join(repoRoot, "subagents/team/orchestrator.md");
  const prompt =
    launch.agentCli === "codex"
      ? mode === "plain"
        ? buildCodexPlainSessionPrompt(tickets, reportPath)
        : buildCodexTeamSessionPrompt(tickets, reportPath)
      : mode === "plain"
        ? buildPlainSessionPrompt(tickets, reportPath)
        : buildTeamSessionPrompt(tickets, reportPath);
  const started = Date.now();
  const command = buildAgentCommand({
    launch,
    prompt,
    name: `subagents-${mode}`,
    delegationNote:
      launch.agentCli === "codex"
        ? mode === "team"
          ? CODEX_TEAM_DELEGATION_NOTE
          : CODEX_PLAIN_DELEGATION_NOTE
        : undefined,
    extraInstructions: launch.agentCli === "codex" && mode === "team" ? readTextFile(orchestratorPath) : undefined,
    extraInstructionsLabel: mode === "team" ? "subagents/team/orchestrator.md" : undefined,
    appendSystemPromptFile: mode === "team" ? orchestratorPath : undefined,
  });
  const result = await runCommand({
    command: command.command,
    args: command.args,
    cwd: repoRoot,
    logPath: path.join(dir, "session.log"),
    timeoutMs: command.timeoutMs ?? undefined,
  });
  const npm = await runCommand({
    command: "npm",
    args: ["test"],
    cwd: repoRoot,
    logPath: path.join(dir, "npm-test.log"),
  });
  const meta = readAgentStream(launch.agentCli, result.stdout);
  const record = blankTicket("session", Date.now() - started);
  record.claudeExitCode = result.code;
  record.npmTestExitCode = npm.code;
  record.testsPassing = npm.code === 0;
  record.delegations = meta.delegations;
  record.sessionId = meta.sessionId;
  record.totalCostUsd = meta.totalCostUsd;
  record.usage = meta.usage;

  const notes = [
    "Setup B records one session wall clock. Per-ticket times stay empty unless you fill them from the report by hand.",
  ];
  if (launch.agentCli === "codex") {
    notes.push(
      "Codex usage is the last turn.completed object in this process. Token fields are not summed, and cost is not estimated.",
    );
    if (meta.delegations === null) {
      notes.push("No Codex JSONL events were found, so delegations were not counted.");
    } else {
      notes.push("Delegations count distinct collab_tool_call items whose tool is spawn_agent.");
    }
  }
  if (result.timedOut) {
    notes.push("The Codex process hit the wall-clock timeout. Codex has no --max-turns.");
  }
  if (meta.failureMessage !== null) {
    notes.push(meta.failureMessage);
  }

  const finished = Date.now();
  const timings: RunTimings = {
    setup: `subagents-${mode}`,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    wallClockMs: finished - started,
    tickets: [record],
    humanInterventions: null,
    plantedBugFound: null,
    notes,
  };
  const timingsPath = path.join(dir, "timings.json");
  await writeFile(timingsPath, `${JSON.stringify(timings, null, 2)}\n`);
  if (launch.agentCli === "codex") {
    process.stdout.write(
      record.delegations === null
        ? "Delegations: not measured\n"
        : `Delegations (spawn_agent items in this process): ${record.delegations}\n`,
    );
  } else {
    process.stdout.write(`Delegations (Agent tool calls in this process): ${record.delegations}\n`);
  }
  process.stdout.write(`Timings written to ${timingsPath}\n`);
  process.stdout.write("Per-ticket wall clocks: not measured\n");
  process.stdout.write("human interventions: not measured\nplanted bug found: not measured\n");
  const agentOk = result.code === 0 && !result.timedOut && !meta.failed;
  return agentOk && npm.code === 0 ? 0 : 1;
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
