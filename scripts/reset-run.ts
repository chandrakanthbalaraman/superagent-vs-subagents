import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { parseFlags } from "./lib/args.js";
import { planReset } from "./lib/reset.js";

const ALLOWED = new Set(["--help", "--dry-run"]);

function help(): string {
  return [
    "Remove lab worktrees, ticket branches, and the runs/ directory.",
    "",
    "Usage: tsx scripts/reset-run.ts [--dry-run]",
    "",
    "Deletes worktrees under .worktrees/, local branches named ticket/* and integrate/*,",
    "and the runs/ folder. Does not reset your current branch or delete commits that are",
    "still referenced by a branch you keep.",
  ].join("\n");
}

const flags = parseFlags(process.argv.slice(2), ALLOWED);
if (flags.has("--help")) {
  process.stdout.write(`${help()}\n`);
  process.exit(0);
}

const repoRoot = process.cwd();
const porcelain = git(["worktree", "list", "--porcelain"]);
const branches = git(["branch", "--format=%(refname:short)"])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const plan = planReset({ worktreePorcelain: porcelain, branches, repoRoot });
const dryRun = flags.has("--dry-run");

if (plan.worktreeRemovals.length === 0 && plan.branchDeletions.length === 0) {
  process.stdout.write(dryRun ? "Dry run. Nothing to remove.\n" : "Nothing to remove.\n");
} else {
  process.stdout.write(dryRun ? "Dry run. Would run:\n" : "Removing lab worktrees and branches:\n");
}

for (const worktree of plan.worktreeRemovals) {
  const args = ["worktree", "remove", "--force", worktree];
  process.stdout.write(`git ${args.join(" ")}\n`);
  if (!dryRun) {
    git(args);
  }
}
for (const branch of plan.branchDeletions) {
  const args = ["branch", "-D", branch];
  process.stdout.write(`git ${args.join(" ")}\n`);
  if (!dryRun) {
    git(args);
  }
}

const runs = path.join(repoRoot, "runs");
process.stdout.write(dryRun ? `Would remove ${runs}\n` : `Removing ${runs}\n`);
if (!dryRun) {
  rmSync(runs, { recursive: true, force: true });
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}
