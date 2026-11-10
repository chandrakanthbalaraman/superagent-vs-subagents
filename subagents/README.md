# Setup B — subagents

One session. The main agent can delegate, and it still owns the kitchen.

- [B1 plain](plain/INSTRUCTIONS.md): one session, every ready ticket, count how often it delegates.
- [B2 team](team/INSTRUCTIONS.md): the same session, pointed at planner, implementer, test-writer, and reviewer.

The runner is `npm run subagents`. Add `--dry-run` to print the `claude` command, or `--agent-cli codex --dry-run` to print `codex exec`. Flags match the super-agent runner (`--permission-mode`, `--max-turns`, `--max-budget-usd`, `--allowed-tools`, `--bare`). Codex does not receive the Claude-only flags. See the root README section "Running with Codex".

Claude Code loads every file in `.claude/agents/`, so this session can also see the super-agent roles. The prompts tell it not to use them. Say that when you write up a result. It is part of the comparison, not a footnote to hide.
