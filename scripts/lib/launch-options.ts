import { parseAgentCli, type AgentCli } from "./agent-cli.js";
import { parsePermissionMode, type PermissionMode } from "./claude-command.js";
import { flagString, requirePositiveInt } from "./args.js";

export const DEFAULT_CODEX_TIMEOUT_SECONDS = 1800;

export type LaunchOptions = {
  dryRun: boolean;
  help: boolean;
  agentCli: AgentCli;
  /** Wall-clock kill for a Codex process. Null means no kill. Ignored for Claude. */
  codexTimeoutSeconds: number | null;
  permissionMode: PermissionMode;
  maxTurns: number;
  maxParallel: number;
  maxBudgetUsd?: string;
  allowedTools: string;
  forwardSubagentText: boolean;
  permissionPrompts?: "none" | "host";
  bare: boolean;
};

export function readLaunchOptions(flags: Map<string, string | true>): LaunchOptions {
  const agentCli = parseAgentCli(
    flagString(flags, "--agent-cli") ?? process.env.SUPERAGENT_AGENT_CLI ?? "claude",
  );
  const permissionMode = parsePermissionMode(
    flagString(flags, "--permission-mode") ?? process.env.SUPERAGENT_PERMISSION_MODE ?? "acceptEdits",
  );
  const maxTurns = requirePositiveInt(
    flagString(flags, "--max-turns") ?? process.env.SUPERAGENT_MAX_TURNS ?? "30",
    "--max-turns",
  );
  const maxParallel = requirePositiveInt(
    flagString(flags, "--max-parallel") ?? process.env.SUPERAGENT_MAX_PARALLEL ?? "3",
    "--max-parallel",
  );
  const prompts = flagString(flags, "--permission-prompts") ?? process.env.SUPERAGENT_PERMISSION_PROMPTS;
  if (agentCli !== "codex") {
    const timeoutFlag = flagString(flags, "--timeout-seconds");
    if (timeoutFlag !== undefined && timeoutFlag !== "0") {
      requirePositiveInt(timeoutFlag, "--timeout-seconds");
    }
  }
  return {
    dryRun: flags.has("--dry-run"),
    help: flags.has("--help"),
    agentCli,
    codexTimeoutSeconds: agentCli === "codex" ? readCodexTimeout(flags) : null,
    permissionMode,
    maxTurns,
    maxParallel,
    maxBudgetUsd: flagString(flags, "--max-budget-usd") ?? process.env.SUPERAGENT_MAX_BUDGET_USD,
    allowedTools: flagString(flags, "--allowed-tools") ?? process.env.SUPERAGENT_ALLOWED_TOOLS ?? "Read,Edit,Write,Bash",
    forwardSubagentText:
      flags.has("--forward-subagent-text") || process.env.SUPERAGENT_FORWARD_SUBAGENT_TEXT === "1",
    permissionPrompts: prompts === undefined ? undefined : parsePermissionPrompts(prompts),
    bare: flags.has("--bare"),
  };
}

function readCodexTimeout(flags: Map<string, string | true>): number | null {
  const raw = flagString(flags, "--timeout-seconds") ?? process.env.SUPERAGENT_TIMEOUT_SECONDS;
  if (raw === undefined) {
    return DEFAULT_CODEX_TIMEOUT_SECONDS;
  }
  if (raw === "0") {
    return null;
  }
  return requirePositiveInt(raw, "--timeout-seconds");
}

function parsePermissionPrompts(value: string): "none" | "host" {
  switch (value) {
    case "none":
    case "host":
      return value;
    default:
      throw new Error(`--permission-prompts must be none or host, not "${value}".`);
  }
}
