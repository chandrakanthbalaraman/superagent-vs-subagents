export const AGENT_CLIS = ["claude", "codex"] as const;

export type AgentCli = (typeof AGENT_CLIS)[number];

export function parseAgentCli(value: string): AgentCli {
  switch (value) {
    case "claude":
    case "codex":
      return value;
    default:
      throw new Error(
        `Unknown agent CLI "${value}". Pass --agent-cli claude or --agent-cli codex (or set SUPERAGENT_AGENT_CLI).`,
      );
  }
}

export function agentBinary(cli: AgentCli): AgentCli {
  switch (cli) {
    case "claude":
      return "claude";
    case "codex":
      return "codex";
    default: {
      const unexpected: never = cli;
      throw new Error(`Unknown agent CLI ${String(unexpected)}`);
    }
  }
}
