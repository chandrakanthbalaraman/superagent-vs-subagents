import { existsSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { agentBinary } from "./agent-cli.js";
import { buildAgentCommand } from "./agent-command.js";
import { readAgentStream, type AgentStreamMeta } from "./agent-stream.js";
import { parseFlags, flagString } from "./args.js";
import { parseBoard, type Ticket } from "./board.js";
import { readRoleMarkdown } from "./codex-prompt.js";
import { readLaunchOptions, type LaunchOptions } from "./launch-options.js";
import { runPool } from "./pool.js";
import { buildRetryPrompt, buildWorkerPrompt } from "./prompt.js";
import { renderSuperagentDryRun, type RunOnly } from "./render-superagent.js";
import { parseWorkerReport } from "./report.js";
import { buildCheckerPrompt, buildMergerPrompt } from "./role-prompts.js";
import { planWaves } from "./scheduler.js";
import { runCommand, type CommandResult } from "./spawn.js";
import { blankTicket, type RunTimings, type TicketRunRecord } from "./timings.js";
import { scanRunDirectory } from "./watchdog.js";
import { commandExists, MISSING_CLAUDE, MISSING_CODEX } from "./which.js";

const ALLOWED = new Set([
  "--help",
  "--dry-run",
  "--ticket",
  "--only",
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

export function superagentHelp(): string {
  return [
    "Dispatch ready Recipe Box tickets to headless workers.",
    "",
    "Usage: tsx scripts/run-superagent.ts [flags]",
    "",
    "  --agent-cli claude|codex   Which CLI to run. Default claude. Env: SUPERAGENT_AGENT_CLI.",
    "  --timeout-seconds <n>      Codex only. Kill the process after n seconds. Default 1800. 0 disables.",
    "  --dry-run                  Print the git and agent commands. Start nothing.",
    "  --ticket <id>              Limit workers to one ticket id from specs/board.md.",
    "  --only all|workers|merger|checker",
    "                             Default all. checker alone reviews the current checkout.",
    "  --permission-mode <mode>   Claude Code permission mode. Default acceptEdits.",
    "  --allowed-tools <list>     Passed to --allowedTools. Default Read,Edit,Write,Bash.",
    "  --max-turns <n>            Default 30.",
    "  --max-budget-usd <amount>  Optional Claude Code spend cap.",
    "  --max-parallel <n>         Workers per wave. Default 3.",
    "  --permission-prompts none|host",
    "                             Optional. none needs Claude Code v2.1.259 or later.",
    "  --forward-subagent-text    Optional. Needs Claude Code v2.1.211 or later.",
    "  --bare                     Optional. Skips project agents and skills. Not the default.",
    "",
    "The same values can be set with SUPERAGENT_PERMISSION_MODE, SUPERAGENT_ALLOWED_TOOLS,",
    "SUPERAGENT_MAX_TURNS, SUPERAGENT_MAX_BUDGET_USD, SUPERAGENT_MAX_PARALLEL,",
    "SUPERAGENT_PERMISSION_PROMPTS, SUPERAGENT_FORWARD_SUBAGENT_TEXT=1,",
    "SUPERAGENT_AGENT_CLI, and SUPERAGENT_TIMEOUT_SECONDS.",
    "",
    "Claude Code flags: https://code.claude.com/docs/en/cli-reference",
    "and https://code.claude.com/docs/en/headless",
    "Codex flags: https://developers.openai.com/codex/noninteractive",
    "Codex is selected with --agent-cli codex. Claude Code stays the default.",
  ].join("\n");
}

export async function executeSuperagent(argv: string[], repoRoot = process.cwd()): Promise<number> {
  const flags = parseFlags(argv, ALLOWED);
  const launch = readLaunchOptions(flags);
  if (launch.help) {
    process.stdout.write(`${superagentHelp()}\n`);
    return 0;
  }

  const tickets = parseBoard(await readFile(path.join(repoRoot, "specs/board.md"), "utf8"));
  const plan = planWaves(tickets);
  const only = parseOnly(flagString(flags, "--only") ?? "all");
  const ticketId = flagString(flags, "--ticket");
  const stamp = runStamp();

  if (launch.dryRun) {
    process.stdout.write(
      `${renderSuperagentDryRun({ repoRoot, tickets, plan, launch, only, ticketId, stamp })}\n`,
    );
    return 0;
  }

  if (!(await commandExists(agentBinary(launch.agentCli)))) {
    process.stderr.write(launch.agentCli === "codex" ? MISSING_CODEX : MISSING_CLAUDE);
    return 1;
  }
  if (!existsSync(path.join(repoRoot, "node_modules"))) {
    process.stderr.write("node_modules is missing. Run npm install in the repo before a real run.\n");
    return 1;
  }

  const runDir = path.join(repoRoot, "runs", stamp);
  await mkdir(runDir, { recursive: true });
  const startedMs = Date.now();
  const records: TicketRunRecord[] = [];
  const notes: string[] = [];
  let workerFailed = false;
  const succeeded = new Set(tickets.filter((ticket) => ticket.status === "done").map((ticket) => ticket.id));
  const stopWatchdog = startWatchdog(runDir);

  try {
    if (only === "all" || only === "workers") {
      for (const wave of plan.waves) {
        const runnable = wave.filter((ticket) => {
          if (ticketId !== undefined && ticket.id !== ticketId) {
            return false;
          }
          return ticket.waitsFor.every((id) => succeeded.has(id));
        });
        await runPool(runnable, launch.maxParallel, async (ticket) => {
          const outcome = await runWorker({ repoRoot, runDir, ticket, launch });
          records.push(outcome.record);
          notes.push(...outcome.notes);
          if (outcome.succeeded) {
            succeeded.add(ticket.id);
          } else {
            workerFailed = true;
          }
        });
      }
      for (const ticket of plan.blocked) {
        if (ticketId === undefined || ticket.id === ticketId) {
          process.stderr.write(
            `${ticket.id} waits for ${ticket.waitsFor.join(", ")} and was not started.\n`,
          );
        }
      }
    }

    if (only === "all" || only === "merger") {
      notes.push(await runMerger({ repoRoot, runDir, stamp, tickets, launch }));
    }
    if (only === "all" || only === "checker") {
      const checkerCwd =
        only === "checker" ? repoRoot : path.join(repoRoot, ".worktrees", `integrate-${stamp}`);
      notes.push(await runChecker({ repoRoot, runDir, launch, cwd: checkerCwd }));
    }

    const finishedMs = Date.now();
    const timings: RunTimings = {
      setup: "superagent",
      startedAt: new Date(startedMs).toISOString(),
      finishedAt: new Date(finishedMs).toISOString(),
      wallClockMs: finishedMs - startedMs,
      tickets: records,
      humanInterventions: null,
      plantedBugFound: null,
      notes,
    };
    const timingsPath = path.join(runDir, "timings.json");
    await writeFile(timingsPath, `${JSON.stringify(timings, null, 2)}\n`);
    process.stdout.write(`Timings written to ${timingsPath}\n`);
    process.stdout.write("human interventions: not measured\nplanted bug found: not measured\n");
    return workerFailed ? 1 : 0;
  } finally {
    stopWatchdog();
  }
}

function parseOnly(value: string): RunOnly {
  switch (value) {
    case "all":
    case "workers":
    case "merger":
    case "checker":
      return value;
    default:
      throw new Error(`--only must be all, workers, merger, or checker. Got "${value}".`);
  }
}

function runStamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function startWatchdog(runDir: string): () => void {
  const tick = () => {
    try {
      const findings = scanRunDirectory({ runDir, nowMs: Date.now(), staleMs: 300_000 });
      void writeFile(path.join(runDir, "watchdog-report.json"), `${JSON.stringify(findings, null, 2)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Watchdog scan failed: ${message}\n`);
    }
  };
  const timer = setInterval(tick, 30_000);
  timer.unref?.();
  return () => {
    clearInterval(timer);
    tick();
  };
}

async function runWorker(input: {
  repoRoot: string;
  runDir: string;
  ticket: Ticket;
  launch: LaunchOptions;
}): Promise<{ record: TicketRunRecord; notes: string[]; succeeded: boolean }> {
  const started = Date.now();
  const ticketDir = path.join(input.runDir, input.ticket.id);
  await mkdir(ticketDir, { recursive: true });
  const prompt = buildWorkerPrompt({
    ticketId: input.ticket.id,
    title: input.ticket.title,
    mode: input.ticket.mode,
    specPath: path.join("specs", "tickets", input.ticket.id, "spec.md"),
    evalPath: path.join("specs", "tickets", input.ticket.id, "eval.md"),
    reportPath: path.join(ticketDir, "report.md"),
    heartbeatPath: path.join(ticketDir, "heartbeat.json"),
  });
  const worktree = await ensureWorktree(input.repoRoot, `.worktrees/${input.ticket.id}`, `ticket/${input.ticket.id}`);
  await writeFile(
    path.join(ticketDir, "status.json"),
    `${JSON.stringify(
      {
        ticketId: input.ticket.id,
        state: "running",
        worktree,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  await writeHeartbeat(ticketDir, "worker process started");

  const first = await runAgent({
    repoRoot: input.repoRoot,
    prompt,
    launch: input.launch,
    name: `worker-${input.ticket.id}`,
    agent: "worker",
    cwd: worktree,
    logPath: path.join(ticketDir, "worker.log"),
    additionalDirs: [ticketDir],
    promptLogPath: path.join(ticketDir, "prompt.md"),
  });
  let combinedStdout = first.stdout;
  let last = first;
  if (agentNeedsRetry(first) && first.meta.sessionId !== null) {
    process.stderr.write(`Retrying ${input.ticket.id} in the same session.\n`);
    const retry = await runAgent({
      repoRoot: input.repoRoot,
      prompt: buildRetryPrompt(input.ticket.id),
      launch: input.launch,
      name: `worker-${input.ticket.id}`,
      agent: "worker",
      cwd: worktree,
      logPath: path.join(ticketDir, "worker.log"),
      resumeSessionId: first.meta.sessionId,
      additionalDirs: [ticketDir],
    });
    combinedStdout = `${first.stdout}\n${retry.stdout}`;
    last = retry;
  }

  const npm = await runCommand({
    command: "npm",
    args: ["test"],
    cwd: worktree,
    logPath: path.join(ticketDir, "npm-test.log"),
  });
  const report = await readReport(path.join(ticketDir, "report.md"));
  const combinedMeta = readAgentStream(input.launch.agentCli, combinedStdout);
  const runNotes = agentRunNotes(input.ticket.id, input.launch, last);
  await writeFile(
    path.join(ticketDir, "status.json"),
    `${JSON.stringify({ ticketId: input.ticket.id, state: "finished", worktree }, null, 2)}\n`,
  );

  const record = blankTicket(input.ticket.id, Date.now() - started);
  record.claudeExitCode = last.code;
  record.npmTestExitCode = npm.code;
  record.testsPassing = npm.code === 0;
  record.delegations = combinedMeta.delegations;
  record.evalFirstTry = report.evalFirstTry;
  if (input.launch.agentCli === "claude") {
    record.sessionId = combinedMeta.sessionId ?? first.meta.sessionId;
    record.totalCostUsd = combinedMeta.totalCostUsd;
    record.usage = combinedMeta.usage;
  } else {
    record.sessionId = last.meta.sessionId ?? first.meta.sessionId;
    record.totalCostUsd = null;
    record.usage = last.meta.usage;
  }
  const succeeded = last.code === 0 && !last.timedOut && !last.meta.failed && npm.code === 0;
  return { record, notes: runNotes, succeeded };
}

async function runMerger(input: {
  repoRoot: string;
  runDir: string;
  stamp: string;
  tickets: Ticket[];
  launch: LaunchOptions;
}): Promise<string> {
  const dir = path.join(input.runDir, "merger");
  await mkdir(dir, { recursive: true });
  const worktree = await ensureWorktree(
    input.repoRoot,
    path.join(".worktrees", `integrate-${input.stamp}`),
    `integrate/${input.stamp}`,
  );
  const prompt = buildMergerPrompt({ tickets: input.tickets, reportPath: path.join(dir, "report.md") });
  const result = await runAgent({
    repoRoot: input.repoRoot,
    prompt,
    launch: input.launch,
    name: "merger",
    agent: "merger",
    cwd: worktree,
    logPath: path.join(dir, "merger.log"),
    additionalDirs: [dir],
  });
  return formatAgentExit("merger", input.launch, result);
}

async function runChecker(input: {
  repoRoot: string;
  runDir: string;
  launch: LaunchOptions;
  cwd: string;
}): Promise<string> {
  const dir = path.join(input.runDir, "checker");
  await mkdir(dir, { recursive: true });
  if (!existsSync(input.cwd)) {
    return `checker skipped because ${input.cwd} does not exist`;
  }
  const prompt = buildCheckerPrompt({ findingsPath: path.join(dir, "findings.md") });
  const result = await runAgent({
    repoRoot: input.repoRoot,
    prompt,
    launch: input.launch,
    name: "checker",
    agent: "checker",
    cwd: input.cwd,
    logPath: path.join(dir, "checker.log"),
    additionalDirs: [dir],
  });
  return formatAgentExit("checker", input.launch, result);
}

type AgentRun = CommandResult & { meta: AgentStreamMeta };

async function runAgent(input: {
  repoRoot: string;
  prompt: string;
  launch: LaunchOptions;
  name: string;
  agent: string;
  cwd: string;
  logPath: string;
  resumeSessionId?: string;
  additionalDirs?: string[];
  promptLogPath?: string;
}): Promise<AgentRun> {
  const command = buildAgentCommand({
    launch: input.launch,
    prompt: input.prompt,
    name: input.name,
    agent: input.agent,
    roleMarkdown: input.launch.agentCli === "codex" ? readRoleMarkdown(input.repoRoot, input.agent) : undefined,
    resumeSessionId: input.resumeSessionId,
    additionalDirs: input.additionalDirs,
  });
  if (input.promptLogPath !== undefined) {
    await writeFile(input.promptLogPath, command.prompt);
  }
  if (command.command === "claude") {
    process.stderr.write(`claude --name ${input.name} in ${input.cwd}\n`);
  } else {
    process.stderr.write(`codex exec in ${input.cwd}\n`);
  }
  const result = await runCommand({
    command: command.command,
    args: command.args,
    cwd: input.cwd,
    logPath: input.logPath,
    timeoutMs: command.timeoutMs ?? undefined,
  });
  return { ...result, meta: readAgentStream(input.launch.agentCli, result.stdout) };
}

function agentNeedsRetry(run: AgentRun): boolean {
  return run.code !== 0 || run.timedOut || run.meta.failed;
}

function agentRunNotes(ticketId: string, launch: LaunchOptions, run: AgentRun): string[] {
  const notes: string[] = [];
  if (run.timedOut) {
    const seconds = launch.codexTimeoutSeconds === null ? "disabled" : String(launch.codexTimeoutSeconds);
    notes.push(`${ticketId} hit the Codex wall-clock timeout (${seconds}s). Codex has no --max-turns.`);
  }
  if (run.meta.failureMessage !== null) {
    notes.push(`${ticketId}: ${run.meta.failureMessage}`);
  }
  return notes;
}

function formatAgentExit(role: string, launch: LaunchOptions, run: AgentRun): string {
  const cli = launch.agentCli === "codex" ? "codex" : "claude";
  const exit = run.code === null ? "none" : String(run.code);
  const timeout = run.timedOut ? " after wall-clock timeout" : "";
  return `${role} ${cli} exit ${exit}${timeout}`;
}

async function ensureWorktree(repoRoot: string, relativePath: string, branch: string): Promise<string> {
  const worktree = path.join(repoRoot, relativePath);
  if (!existsSync(worktree)) {
    await mkdir(path.dirname(worktree), { recursive: true });
    const created = await runCommand({
      command: "git",
      args: ["worktree", "add", "-b", branch, worktree, "HEAD"],
      cwd: repoRoot,
    });
    if (created.code !== 0) {
      throw new Error(`git worktree add failed for ${branch}.\n${created.stderr || created.stdout}`);
    }
  }
  const link = path.join(worktree, "node_modules");
  if (!existsSync(link)) {
    await symlink(path.join(repoRoot, "node_modules"), link, "dir");
  }
  return worktree;
}

async function writeHeartbeat(ticketDir: string, note: string): Promise<void> {
  await writeFile(
    path.join(ticketDir, "heartbeat.json"),
    `${JSON.stringify({ updatedAt: new Date().toISOString(), note })}\n`,
  );
}

async function readReport(file: string): Promise<ReturnType<typeof parseWorkerReport>> {
  try {
    return parseWorkerReport(await readFile(file, "utf8"));
  } catch {
    return { status: null, evalFirstTry: null, tests: null, summary: null };
  }
}
