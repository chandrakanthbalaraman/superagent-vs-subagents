/**
 * Flags passed to the Claude Code CLI.
 *
 * Checked against the official docs on 2026-11-10:
 * https://code.claude.com/docs/en/cli-reference
 * https://code.claude.com/docs/en/headless
 *
 * `-p` runs one prompt and exits. `--output-format stream-json` prints JSON
 * lines and a final result event (the docs' streaming examples also pass
 * `--verbose`). `--permission-mode` and `--allowedTools` are how an unattended
 * run avoids sitting on a prompt. `--max-turns` caps the loop. `--agent`
 * selects a markdown agent from `.claude/agents`. `--continue` and `--resume`
 * return to the same session. Optional flags are added only when set:
 * `--max-budget-usd`, `--append-system-prompt-file`, `--forward-subagent-text`,
 * `--permission-prompts`, `--add-dir`, and `--bare`.
 */

const PERMISSION_MODES = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "manual",
] as const;

export type PermissionMode = (typeof PERMISSION_MODES)[number];

export type ClaudeLaunch = {
  prompt: string;
  permissionMode: string;
  maxTurns: number;
  name: string;
  agent?: string;
  continueConversation?: boolean;
  resumeSessionId?: string;
  maxBudgetUsd?: string;
  appendSystemPromptFile?: string;
  forwardSubagentText?: boolean;
  permissionPrompts?: "none" | "host";
  allowedTools?: string;
  bare?: boolean;
  additionalDirs?: string[];
};

export function parsePermissionMode(value: string): PermissionMode {
  switch (value) {
    case "default":
    case "acceptEdits":
    case "plan":
    case "auto":
    case "dontAsk":
    case "bypassPermissions":
    case "manual":
      return value;
    default:
      throw new Error(
        `Unknown permission mode "${value}". Claude Code accepts: ${PERMISSION_MODES.join(", ")}.`,
      );
  }
}

export function buildClaudeArgs(input: ClaudeLaunch): string[] {
  const permissionMode = parsePermissionMode(input.permissionMode);
  const args: string[] = [];
  if (input.bare) {
    args.push("--bare");
  }
  args.push(
    "-p",
    input.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    permissionMode,
    "--allowedTools",
    input.allowedTools ?? "Read,Edit,Write,Bash",
    "--max-turns",
    String(input.maxTurns),
  );
  if (input.agent !== undefined) {
    args.push("--agent", input.agent);
  }
  args.push("--name", input.name);
  if (input.continueConversation) {
    args.push("--continue");
  }
  if (input.resumeSessionId !== undefined) {
    args.push("--resume", input.resumeSessionId);
  }
  if (input.maxBudgetUsd !== undefined) {
    args.push("--max-budget-usd", input.maxBudgetUsd);
  }
  if (input.appendSystemPromptFile !== undefined) {
    args.push("--append-system-prompt-file", input.appendSystemPromptFile);
  }
  if (input.forwardSubagentText) {
    args.push("--forward-subagent-text");
  }
  if (input.permissionPrompts !== undefined) {
    args.push("--permission-prompts", input.permissionPrompts);
  }
  for (const directory of input.additionalDirs ?? []) {
    args.push("--add-dir", directory);
  }
  return args;
}
