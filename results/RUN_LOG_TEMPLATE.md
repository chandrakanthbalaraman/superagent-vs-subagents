# Run log

Copy this file to `runs/<stamp>/RUN_LOG.md` after a real run. Delete every hint in parentheses. Leave a line blank if you did not measure it.

```text
setup: (superagent | subagents-plain | subagents-team)
stamp:
git sha:
claude version: (claude --version)
node version:
permission mode:
started at:
finished at:
session wall clock:

tickets:
- id:
  wall clock:
  claude exit:
  npm test exit:
  eval first try: (true, false, or blank)
  delegations: (Agent tool calls in the log, or blank)
  session id:
  cost usd: (only if the result event included it)
  notes:

human interventions: (count the times you typed a decision; blank if you did not keep count)
planted bug found: (yes or no, scored after reading the checker findings; blank until then)
what you would not claim:
```

The runner writes `timings.json` next to the logs. Prefer that file over a memory of how long the run felt.
