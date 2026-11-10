import { parsePermissionMode, type PermissionMode } from "./claude-command.js";

/**
 * Flags passed to the Codex CLI for a headless run.
 *
 * Checked on 2026-11-10 against:
 * - https://developers.openai.com/codex/noninteractive
 * - `codex exec --help` and `codex exec resume --help` from `@openai/codex` 0.167.0
 *
 * `codex exec` is the headless command. `--json` prints JSONL on stdout.
 * The default sandbox is read-only. `--approve-for-me` selects the
 * workspace-write sandbox and routes approval requests through automatic
 * review. The CLI rejects `--approve-for-me` together with `--sandbox`.
 * `--full-auto` is not a current flag and is not passed.
 *
 * Resume flags that the parent command owns (`--json`, `--approve-for-me`,
 * `--add-dir`, `--color`) must come before the `resume` subcommand.
 * `codex exec resume --approve-for-me` is rejected by this CLI.
 */

export type CodexLaunch = {
  prompt: string;
  permissionMode: string;
  resumeSessionId?: string;
  additionalDirs?: string[];
};

export function buildCodexArgs(input: CodexLaunch): string[] {
  const permissionMode = parsePermissionMode(input.permissionMode);
  const args = ["exec", "--json", "--color", "never", ...permissionArgs(permissionMode)];
  for (const directory of input.additionalDirs ?? []) {
    args.push("--add-dir", directory);
  }
  if (input.resumeSessionId !== undefined) {
    args.push("resume", input.resumeSessionId);
  }
  args.push(input.prompt);
  return args;
}

function permissionArgs(mode: PermissionMode): string[] {
  switch (mode) {
    case "acceptEdits":
      return ["--approve-for-me"];
    case "bypassPermissions":
      return ["--dangerously-bypass-approvals-and-sandbox"];
    case "default":
    case "plan":
    case "auto":
    case "dontAsk":
    case "manual":
      throw new Error(
        `Codex has no permission mode "${mode}". acceptEdits maps to --approve-for-me (workspace-write sandbox and automatic review). bypassPermissions maps to --dangerously-bypass-approvals-and-sandbox. Other Claude permission modes are not passed through.`,
      );
    default: {
      const unexpected: never = mode;
      throw new Error(`Unknown permission mode ${String(unexpected)}`);
    }
  }
}
