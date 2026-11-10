import type { LaunchOptions } from "./launch-options.js";
import { buildClaudeArgs } from "./claude-command.js";
import { buildCodexArgs } from "./codex-command.js";
import { assembleCodexPrompt } from "./codex-prompt.js";

export type AgentCommand = {
  command: "claude" | "codex";
  args: string[];
  prompt: string;
  timeoutMs: number | null;
};

export function buildAgentCommand(input: {
  launch: LaunchOptions;
  prompt: string;
  name: string;
  agent?: string;
  roleMarkdown?: string;
  extraInstructions?: string;
  extraInstructionsLabel?: string;
  delegationNote?: string;
  resumeSessionId?: string;
  additionalDirs?: string[];
  appendSystemPromptFile?: string;
}): AgentCommand {
  switch (input.launch.agentCli) {
    case "claude":
      return {
        command: "claude",
        prompt: input.prompt,
        timeoutMs: null,
        args: buildClaudeArgs({
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
          appendSystemPromptFile: input.appendSystemPromptFile,
        }),
      };
    case "codex": {
      const prompt = assembleCodexPrompt({
        taskPrompt: input.prompt,
        roleMarkdown: input.roleMarkdown,
        extraInstructions: input.extraInstructions,
        extraInstructionsLabel: input.extraInstructionsLabel,
        delegationNote: input.delegationNote,
      });
      return {
        command: "codex",
        prompt,
        timeoutMs:
          input.launch.codexTimeoutSeconds === null ? null : input.launch.codexTimeoutSeconds * 1000,
        args: buildCodexArgs({
          prompt,
          permissionMode: input.launch.permissionMode,
          resumeSessionId: input.resumeSessionId,
          additionalDirs: input.additionalDirs,
        }),
      };
    }
    default: {
      const unexpected: never = input.launch.agentCli;
      throw new Error(`Unknown agent CLI ${String(unexpected)}`);
    }
  }
}

export function codexDryRunNotes(timeoutSeconds: number | null): string[] {
  const timeout =
    timeoutSeconds === null
      ? "The wall-clock timeout is disabled (--timeout-seconds 0). A stuck Codex process runs until you stop it."
      : `The runner kills each Codex process after ${timeoutSeconds}s of wall clock (--timeout-seconds, default 1800, 0 disables). That is not a turn limit.`;
  return [
    "Backend: codex (`codex exec`). Select it with --agent-cli codex or SUPERAGENT_AGENT_CLI=codex. The default is claude.",
    "acceptEdits maps to --approve-for-me, which selects the workspace-write sandbox and automatic review. The CLI rejects --approve-for-me together with --sandbox. --full-auto is not passed.",
    `Codex has no --max-turns. ${timeout}`,
    "Codex has no --agent. Setup A inlines .claude/agents/<role>.md into the prompt. Setup B team loads .codex/agents/*.toml and the prompt tells Codex to spawn planner, implementer, test-writer, and reviewer.",
    "Codex has no --allowedTools, --name, --max-budget-usd, --append-system-prompt-file, --forward-subagent-text, --permission-prompts, or --bare. Those values are not passed. turn.completed has token counts and no dollar cost, so totalCostUsd stays empty.",
    "--add-dir is passed when the report directory is outside the working tree. `codex exec --help` describes it as an extra writable directory. The noninteractive overview page does not mention it.",
    "Delegations count distinct JSONL items with type collab_tool_call and tool spawn_agent. A session that produced events and no spawn item records 0. If the log has no Codex events, the count stays empty.",
  ];
}
