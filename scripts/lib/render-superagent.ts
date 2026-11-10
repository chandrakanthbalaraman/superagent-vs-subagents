import path from "node:path";
import type { Ticket } from "./board.js";
import { buildAgentCommand, codexDryRunNotes, type AgentCommand } from "./agent-command.js";
import { readRoleMarkdown } from "./codex-prompt.js";
import type { LaunchOptions } from "./launch-options.js";
import { buildRetryPrompt, buildWorkerPrompt } from "./prompt.js";
import { buildCheckerPrompt, buildMergerPrompt } from "./role-prompts.js";
import type { WavePlan } from "./scheduler.js";
import { formatArgv } from "./shell.js";

export type RunOnly = "all" | "workers" | "merger" | "checker";

export function renderSuperagentDryRun(input: {
  repoRoot: string;
  tickets: Ticket[];
  plan: WavePlan;
  launch: LaunchOptions;
  only: RunOnly;
  ticketId?: string;
  stamp: string;
}): string {
  const lines: string[] = [
    input.launch.agentCli === "codex"
      ? "Dry run. No worktrees, no Codex process, no timings."
      : "Dry run. No worktrees, no Claude Code process, no timings.",
    "",
  ];
  if (input.launch.agentCli === "codex") {
    lines.push(...codexDryRunNotes(input.launch.codexTimeoutSeconds), "");
  }
  lines.push(`Ready tickets: ${input.tickets.filter((ticket) => ticket.status === "ready").length}.`);

  if (input.only === "all" || input.only === "workers") {
    lines.push(...renderWaves(input.plan));
    for (const [index, wave] of input.plan.waves.entries()) {
      for (const ticket of wave) {
        if (input.ticketId !== undefined && ticket.id !== input.ticketId) {
          continue;
        }
        lines.push(
          "",
          ...renderWorker({
            repoRoot: input.repoRoot,
            ticket,
            launch: input.launch,
            stamp: input.stamp,
            waveNumber: index + 1,
          }),
        );
      }
    }
    for (const ticket of input.plan.blocked) {
      if (input.ticketId !== undefined && ticket.id !== input.ticketId) {
        continue;
      }
      lines.push(
        "",
        `${ticket.id} waits for ${ticket.waitsFor.join(", ") || "a dependency that is not ready"}.`,
        "It is not started in this run.",
      );
    }
    if (input.ticketId !== undefined && !knowsTicket(input.tickets, input.ticketId)) {
      lines.push("", `Unknown ticket ${input.ticketId}.`);
    }
    lines.push(
      "",
      "Watchdog during the run (the script, not an extra model call):",
      formatArgv("tsx", [
        "scripts/watchdog.ts",
        "--runs",
        path.join("runs", input.stamp),
        "--stale-seconds",
        "300",
      ]),
    );
  }

  if (input.only === "all" || input.only === "merger") {
    const reportDir = path.join(input.repoRoot, "runs", input.stamp, "merger");
    const reportPath = path.join(reportDir, "report.md");
    lines.push(
      "",
      "Merger, after the workers, in a new integrate worktree:",
      `git worktree add -b integrate/${input.stamp} ${path.join(".worktrees", `integrate-${input.stamp}`)} HEAD`,
      renderAgent({
        repoRoot: input.repoRoot,
        launch: input.launch,
        prompt: buildMergerPrompt({ tickets: input.tickets, reportPath }),
        name: "merger",
        agent: "merger",
        additionalDirs: [reportDir],
      }),
    );
  }

  if (input.only === "all" || input.only === "checker") {
    const reportDir = path.join(input.repoRoot, "runs", input.stamp, "checker");
    const findingsPath = path.join(reportDir, "findings.md");
    lines.push(
      "",
      "Checker, after the merger. With --only checker it runs in the current checkout instead.",
      "The runner creates the report directory before launch so --add-dir exists.",
      renderAgent({
        repoRoot: input.repoRoot,
        launch: input.launch,
        prompt: buildCheckerPrompt({ findingsPath }),
        name: "checker",
        agent: "checker",
        additionalDirs: [reportDir],
      }),
    );
  }

  lines.push("");
  return lines.join("\n");
}

function renderWaves(plan: WavePlan): string[] {
  const lines = [""];
  if (plan.waves.length === 0) {
    lines.push("No ready wave to start.");
  }
  for (const [index, wave] of plan.waves.entries()) {
    const described = wave.map((ticket) => {
      if (ticket.waitsFor.length === 0) {
        return ticket.id;
      }
      return `${ticket.id} (waits for ${ticket.waitsFor.join(", ")})`;
    });
    lines.push(`Wave ${index + 1}: ${described.join(", ")}`);
  }
  return lines;
}

function renderWorker(input: {
  repoRoot: string;
  ticket: Ticket;
  launch: LaunchOptions;
  stamp: string;
  waveNumber: number;
}): string[] {
  const worktree = path.join(".worktrees", input.ticket.id);
  const ticketDir = path.join(input.repoRoot, "runs", input.stamp, input.ticket.id);
  const prompt = workerPrompt(input.repoRoot, input.ticket, input.stamp);
  const launch = agentCommand({
    repoRoot: input.repoRoot,
    launch: input.launch,
    prompt,
    name: `worker-${input.ticket.id}`,
    agent: "worker",
    additionalDirs: [ticketDir],
  });
  const retry = agentCommand({
    repoRoot: input.repoRoot,
    launch: input.launch,
    prompt: buildRetryPrompt(input.ticket.id),
    name: `worker-${input.ticket.id}`,
    agent: "worker",
    resumeSessionId: "<session_id>",
    additionalDirs: [ticketDir],
  });
  const retryLine =
    input.launch.agentCli === "codex"
      ? "If codex exits non-zero, reports turn.failed or error, or hits the wall-clock timeout, and thread.started included thread_id, one retry in the same worktree:"
      : "If claude exits non-zero and the result event includes session_id, one retry in the same worktree:";
  return [
    `Worker ${input.ticket.id} (${input.ticket.mode}) in wave ${input.waveNumber}`,
    `git worktree add -b ticket/${input.ticket.id} ${worktree} HEAD`,
    `ln -s ${path.join(input.repoRoot, "node_modules")} ${path.join(worktree, "node_modules")}`,
    `cwd: ${worktree}`,
    formatArgv(launch.command, launch.args),
    "prompt:",
    launch.prompt,
    retryLine,
    formatArgv(retry.command, retry.args),
    "npm test",
  ];
}

function renderAgent(input: {
  repoRoot: string;
  launch: LaunchOptions;
  prompt: string;
  name: string;
  agent: string;
  additionalDirs: string[];
}): string {
  const command = agentCommand(input);
  return formatArgv(command.command, command.args);
}

function agentCommand(input: {
  repoRoot: string;
  launch: LaunchOptions;
  prompt: string;
  name: string;
  agent?: string;
  resumeSessionId?: string;
  additionalDirs?: string[];
}): AgentCommand {
  return buildAgentCommand({
    launch: input.launch,
    prompt: input.prompt,
    name: input.name,
    agent: input.agent,
    roleMarkdown:
      input.launch.agentCli === "codex" && input.agent !== undefined
        ? readRoleMarkdown(input.repoRoot, input.agent)
        : undefined,
    resumeSessionId: input.resumeSessionId,
    additionalDirs: input.additionalDirs,
  });
}

function workerPrompt(repoRoot: string, ticket: Ticket, stamp: string): string {
  const ticketDir = path.join(repoRoot, "runs", stamp, ticket.id);
  return buildWorkerPrompt({
    ticketId: ticket.id,
    title: ticket.title,
    mode: ticket.mode,
    specPath: path.join("specs", "tickets", ticket.id, "spec.md"),
    evalPath: path.join("specs", "tickets", ticket.id, "eval.md"),
    reportPath: path.join(ticketDir, "report.md"),
    heartbeatPath: path.join(ticketDir, "heartbeat.json"),
  });
}

function knowsTicket(tickets: Ticket[], ticketId: string): boolean {
  return tickets.some((ticket) => ticket.id === ticketId);
}
