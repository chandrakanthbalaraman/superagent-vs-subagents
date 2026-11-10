# Setup B2 — team in one session

Same tickets, same checkout, one session. The session is told to delegate to four project subagents:

| Agent | Job |
| --- | --- |
| planner | Order the ready tickets. No code. |
| implementer | Build one ticket from its spec. |
| test-writer | Add the tests named in the eval. |
| reviewer | Check the diff against the eval. No edits. |

Definitions live in `.claude/agents/` so Claude Code loads them. The extra instructions are `subagents/team/orchestrator.md`, passed with `--append-system-prompt-file`.

```bash
npm run subagents -- --dry-run --mode team
npm run subagents -- --mode team
```

Use a throwaway clone. This session edits the working tree, unlike setup A, which edits git worktrees.

The runner again counts `Agent` tool calls. That count is the delegation number. It is not a guess from the prose. If the log has no `tool_use` blocks named `Agent`, the delegation cell stays a measured zero only after a real run; a dry-run measures nothing.

`--mode both` is dry-run only. A real plain run and a real team run need two clones so they do not share edits.
