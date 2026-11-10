# Setup A — super agent

The expediter does not cook. A router talks to you. Each ready ticket goes to a worker in its own git worktree and its own Claude Code session. A watchdog script watches for silence. A merger integrates branches. A checker compares the app with `docs/prd.md`.

This folder is the map. The agent definitions Claude Code loads are in `.claude/agents/`:

| File | Role |
| --- | --- |
| `router.md` | Talks to the human. Runs the runner. Writes no code. |
| `worker.md` | One ticket, one worktree, reports back. |
| `watchdog.md` | Reads the watchdog report. Writes no code. |
| `merger.md` | Merges `ticket/*` branches and runs `npm test`. |
| `checker.md` | Calls the API and writes findings. |

The mechanical runner is `scripts/run-superagent.ts` (`npm run superagent`). It is the part that creates worktrees and starts `claude -p`. The router is optional conversation on top of that script.

Workers are not started with Claude Code's `--worktree` / `-w` flag, and the worker agent does not set `isolation: worktree`. Those are real Claude Code features. This lab uses `git worktree add` so the branch is `ticket/<id>`, the path is `.worktrees/<id>`, and the watchdog can see the last commit.

The watchdog that runs during a job is `scripts/watchdog.ts`, every 30 seconds. It does not call a model. Open `claude --agent watchdog` afterward if you want a model to read `watchdog-report.json`.

DeepSeek's research prototype is [deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype). This folder is a teaching harness that uses Claude Code as the worker. It is not a fork of that repository. Their writeup describes a watchdog; the public prototype left that piece as later work. The script here is the small version you can run.
