import path from "node:path";
import type { Ticket } from "./board.js";
import { buildAgentCommand, codexDryRunNotes } from "./agent-command.js";
import { CODEX_PLAIN_DELEGATION_NOTE, CODEX_TEAM_DELEGATION_NOTE, readTextFile } from "./codex-prompt.js";
import type { LaunchOptions } from "./launch-options.js";
import {
  buildCodexPlainSessionPrompt,
  buildCodexTeamSessionPrompt,
  buildPlainSessionPrompt,
  buildTeamSessionPrompt,
} from "./role-prompts.js";
import { formatArgv } from "./shell.js";

export type SubagentMode = "plain" | "team" | "both";

export function renderSubagentsDryRun(input: {
  repoRoot: string;
  tickets: Ticket[];
  launch: LaunchOptions;
  mode: SubagentMode;
  stamp: string;
}): string {
  const lines = [
    input.launch.agentCli === "codex"
      ? "Dry run. No Codex process, no timings."
      : "Dry run. No Claude Code process, no timings.",
    "",
  ];
  if (input.launch.agentCli === "codex") {
    lines.push(...codexDryRunNotes(input.launch.codexTimeoutSeconds), "");
  }
  const modes: Array<"plain" | "team"> = input.mode === "both" ? ["plain", "team"] : [input.mode];
  for (const mode of modes) {
    const dir = path.join(input.repoRoot, "runs", input.stamp, `subagents-${mode}`);
    const prompt = sessionPrompt(input.launch, input.tickets, path.join(dir, "report.md"), mode);
    const orchestratorPath = path.join(input.repoRoot, "subagents/team/orchestrator.md");
    const command = buildAgentCommand({
      launch: input.launch,
      prompt,
      name: `subagents-${mode}`,
      delegationNote:
        input.launch.agentCli === "codex"
          ? mode === "team"
            ? CODEX_TEAM_DELEGATION_NOTE
            : CODEX_PLAIN_DELEGATION_NOTE
          : undefined,
      extraInstructions:
        input.launch.agentCli === "codex" && mode === "team" ? readTextFile(orchestratorPath) : undefined,
      extraInstructionsLabel: mode === "team" ? "subagents/team/orchestrator.md" : undefined,
      appendSystemPromptFile: mode === "team" ? orchestratorPath : undefined,
    });
    lines.push(
      `Setup B ${mode === "plain" ? "plain (one session, subagents optional)" : "team (planner, implementer, test-writer, reviewer)"}`,
      "cwd: .",
      formatArgv(command.command, command.args),
      "prompt:",
      command.prompt,
      "npm test",
      "",
    );
  }
  if (input.mode === "both") {
    lines.push("A real run refuses --mode both. Use two clones so the sessions do not edit the same files.");
  }
  return lines.join("\n");
}

function sessionPrompt(
  launch: LaunchOptions,
  tickets: Ticket[],
  reportPath: string,
  mode: "plain" | "team",
): string {
  if (launch.agentCli === "codex") {
    return mode === "plain"
      ? buildCodexPlainSessionPrompt(tickets, reportPath)
      : buildCodexTeamSessionPrompt(tickets, reportPath);
  }
  return mode === "plain" ? buildPlainSessionPrompt(tickets, reportPath) : buildTeamSessionPrompt(tickets, reportPath);
}
