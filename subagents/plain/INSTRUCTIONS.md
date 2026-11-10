# Setup B1 — plain session

One Claude Code session gets every ready ticket. It may use subagents. You write down how often it actually does.

The project agents in `.claude/agents/` are visible in a normal session, including the super-agent roles and the team roles. That is a confound. This setup does not hide them. The prompt tells the session not to use the super-agent roles. If you want a session that does not auto-load project agents, pass `--bare`. Bare mode also skips skills and project instructions, and it does not use a Claude subscription login: set `ANTHROPIC_API_KEY`. The flag is documented on the [headless page](https://code.claude.com/docs/en/headless).

## Recorded run

From a throwaway clone, on a clean `HEAD`:

```bash
npm install
npm test
npm run subagents -- --dry-run --mode plain
npm run subagents -- --mode plain
```

The runner prints the `claude -p` command it would use, then on a real run:

- writes the transcript to `runs/<stamp>/subagents-plain/session.log`
- counts `Agent` tool calls in that log
- runs `npm test` afterward
- writes `timings.json`

Per-ticket times are not measured. The session is one clock. Copy the session wall clock into the results table and leave the per-ticket cells blank unless you timed them yourself.

## Interactive run

```bash
claude
```

Paste the prompt from the dry-run. When the session ends, count delegations by searching the transcript for subagent spawns, or re-run through the script so the count is mechanical.

Do not open root-level dotfiles before you score the run.
