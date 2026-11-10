import type { AgentCli } from "./agent-cli.js";
import { readCodexEventMeta } from "./codex-events.js";
import { countDelegations, readResultMeta } from "./delegations.js";

export type AgentStreamMeta = {
  sessionId: string | null;
  totalCostUsd: number | null;
  usage: unknown | null;
  delegations: number | null;
  failed: boolean;
  failureMessage: string | null;
};

export function readAgentStream(cli: AgentCli, stream: string): AgentStreamMeta {
  switch (cli) {
    case "claude": {
      const meta = readResultMeta(stream);
      return {
        sessionId: meta.sessionId,
        totalCostUsd: meta.totalCostUsd,
        usage: meta.usage,
        delegations: countDelegations(stream),
        failed: false,
        failureMessage: null,
      };
    }
    case "codex": {
      const meta = readCodexEventMeta(stream);
      return {
        sessionId: meta.sessionId,
        totalCostUsd: null,
        usage: meta.usage,
        delegations: meta.delegations,
        failed: meta.failed,
        failureMessage: meta.failureMessage,
      };
    }
    default: {
      const unexpected: never = cli;
      throw new Error(`Unknown agent CLI ${String(unexpected)}`);
    }
  }
}
