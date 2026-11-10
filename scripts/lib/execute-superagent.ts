import { existsSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseFlags, flagString } from "./args.js";
import { parseBoard, type Ticket } from "./board.js";
import { buildClaudeArgs } from "./claude-command.js";
import { readLaunchOptions, type LaunchOptions } from "./launch-options.js";
import { runPool } from "./pool.js";
import { buildRetryPrompt, buildWorkerPrompt } from "./prompt.js";
import { renderSuperagentDryRun, type RunOnly } from "./render-superagent.js";
import { parseWorkerReport } from "./report.js";
import { buildCheckerPrompt, buildMergerPrompt } from "./role-prompts.js";
import { planWaves } from "./scheduler.js";
import { runCommand } from "./spawn.js";
import { countDelegations, readResultMeta } from "./delegations.js";
import { blankTicket, type RunTimings, type TicketRunRecord } from "./timings.js";
import { scanRunDirectory } from "./watchdog.js";
import { commandExists, MISSING_CLAUDE } from "./which.js";

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
]);

export function superagentHelp(): string {
  return [
    "Dispatch ready Recipe Box tickets to headless Claude Code workers.",
    "",
    "Usage: tsx scripts/run-superagent.ts [flags]",
    "",
    "  --dry-run                  Print the git and claude commands. Start nothing.",
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
    "SUPERAGENT_PERMISSION_PROMPTS, and SUPERAGENT_FORWARD_SUBAGENT_TEXT=1.",
    "",
    "Flags are the Claude Code flags documented at",
    "https://code.claude.com/docs/en/cli-reference",
    "and https://code.claude.com/docs/en/headless",
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

  if (!(await commandExists("claude"))) {
    process.stderr.write(MISSING_CLAUDE);
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
          const record = await runWorker({ repoRoot, runDir, ticket, launch });
          records.push(record);
          if (record.claudeExitCode === 0 && record.npmTestExitCode === 0) {
            succeeded.add(ticket.id);
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

    const notes: string[] = [];
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
    return records.some((record) => record.claudeExitCode !== 0 || record.npmTestExitCode !== 0) ? 1 : 0;
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
}): Promise<TicketRunRecord> {
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
  await writeFile(path.join(ticketDir, "prompt.md"), prompt);
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

  const first = await runClaude({
    prompt,
    launch: input.launch,
    name: `worker-${input.ticket.id}`,
    agent: "worker",
    cwd: worktree,
    logPath: path.join(ticketDir, "worker.log"),
    additionalDirs: [ticketDir],
  });
  let combinedStdout = first.stdout;
  let exitCode = first.code;
  if (first.code !== 0 && first.meta.sessionId !== null) {
    process.stderr.write(`Retrying ${input.ticket.id} in the same session.\n`);
    const retry = await runClaude({
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
    exitCode = retry.code;
  }

  const npm = await runCommand({
    command: "npm",
    args: ["test"],
    cwd: worktree,
    logPath: path.join(ticketDir, "npm-test.log"),
  });
  const report = await readReport(path.join(ticketDir, "report.md"));
  const meta = readResultMeta(combinedStdout);
  await writeFile(
    path.join(ticketDir, "status.json"),
    `${JSON.stringify({ ticketId: input.ticket.id, state: "finished", worktree }, null, 2)}\n`,
  );

  const record = blankTicket(input.ticket.id, Date.now() - started);
  record.claudeExitCode = exitCode;
  record.npmTestExitCode = npm.code;
  record.testsPassing = npm.code === 0;
  record.delegations = countDelegations(combinedStdout);
  record.evalFirstTry = report.evalFirstTry;
  record.sessionId = meta.sessionId ?? first.meta.sessionId;
  record.totalCostUsd = meta.totalCostUsd;
  record.usage = meta.usage;
  return record;
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
  const result = await runClaude({
    prompt,
    launch: input.launch,
    name: "merger",
    agent: "merger",
    cwd: worktree,
    logPath: path.join(dir, "merger.log"),
    additionalDirs: [dir],
  });
  return `merger claude exit ${result.code}`;
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
  const result = await runClaude({
    prompt,
    launch: input.launch,
    name: "checker",
    agent: "checker",
    cwd: input.cwd,
    logPath: path.join(dir, "checker.log"),
    additionalDirs: [dir],
  });
  return `checker claude exit ${result.code}`;
}

async function runClaude(input: {
  prompt: string;
  launch: LaunchOptions;
  name: string;
  agent: string;
  cwd: string;
  logPath: string;
  resumeSessionId?: string;
  additionalDirs?: string[];
}): Promise<{ code: number; stdout: string; meta: ReturnType<typeof readResultMeta> }> {
  const args = buildClaudeArgs({
    prompt: input.prompt,
    permissionMode: input.launch.permissionMode,
    maxTurns: input.launch.maxTurns,
    name: input.name,
    agent: input.agent,
    allowedTools: input.launch.allowedTools,
    maxBudgetUsd: input.launch.maxBudgetUsd,
    forwardSubagentText: input.launch.forwardSubagentText,
    permissionPrompts: input.launch.permissionPrompts,
    bare: input.launch.bare,
    resumeSessionId: input.resumeSessionId,
    additionalDirs: input.additionalDirs,
  });
  process.stderr.write(`claude --name ${input.name} in ${input.cwd}\n`);
  const result = await runCommand({ command: "claude", args, cwd: input.cwd, logPath: input.logPath });
  return { code: result.code, stdout: result.stdout, meta: readResultMeta(result.stdout) };
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
