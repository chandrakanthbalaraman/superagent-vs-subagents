import path from "node:path";
import type { Ticket } from "./board.js";
import { buildClaudeArgs } from "./claude-command.js";
import type { LaunchOptions } from "./launch-options.js";
import { buildPlainSessionPrompt, buildTeamSessionPrompt } from "./role-prompts.js";
import { formatArgv } from "./shell.js";

export type SubagentMode = "plain" | "team" | "both";

export function renderSubagentsDryRun(input: {
  repoRoot: string;
  tickets: Ticket[];
  launch: LaunchOptions;
  mode: SubagentMode;
  stamp: string;
}): string {
  const lines = ["Dry run. No Claude Code process, no timings.", ""];
  const modes: Array<"plain" | "team"> = input.mode === "both" ? ["plain", "team"] : [input.mode];
  for (const mode of modes) {
    const dir = path.join(input.repoRoot, "runs", input.stamp, `subagents-${mode}`);
    const prompt =
      mode === "plain"
        ? buildPlainSessionPrompt(input.tickets, path.join(dir, "report.md"))
        : buildTeamSessionPrompt(input.tickets, path.join(dir, "report.md"));
    const args = buildClaudeArgs({
      prompt,
      permissionMode: input.launch.permissionMode,
      maxTurns: input.launch.maxTurns,
      name: `subagents-${mode}`,
      allowedTools: input.launch.allowedTools,
      maxBudgetUsd: input.launch.maxBudgetUsd,
      forwardSubagentText: input.launch.forwardSubagentText,
      permissionPrompts: input.launch.permissionPrompts,
      bare: input.launch.bare,
      appendSystemPromptFile:
        mode === "team" ? path.join(input.repoRoot, "subagents/team/orchestrator.md") : undefined,
    });
    lines.push(
      `Setup B ${mode === "plain" ? "plain (one session, subagents optional)" : "team (planner, implementer, test-writer, reviewer)"}`,
      "cwd: .",
      formatArgv("claude", args),
      "prompt:",
      prompt,
      "npm test",
      "",
    );
  }
  if (input.mode === "both") {
    lines.push("A real run refuses --mode both. Use two clones so the sessions do not edit the same files.");
  }
  return lines.join("\n");
}
