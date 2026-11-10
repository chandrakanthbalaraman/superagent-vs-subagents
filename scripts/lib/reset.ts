import path from "node:path";

export type ResetPlan = {
  worktreeRemovals: string[];
  branchDeletions: string[];
};

export function planReset(input: {
  worktreePorcelain: string;
  branches: string[];
  repoRoot: string;
}): ResetPlan {
  const root = path.resolve(input.repoRoot);
  const worktreeRoot = path.resolve(root, ".worktrees");
  const worktreeRemovals = parseWorktreePaths(input.worktreePorcelain).filter((worktreePath) => {
    const resolved = path.resolve(worktreePath);
    return resolved === worktreeRoot || resolved.startsWith(worktreeRoot + path.sep);
  });
  const branchDeletions = input.branches.filter((branch) => branch.startsWith("ticket/") || branch.startsWith("integrate/"));
  return { worktreeRemovals, branchDeletions };
}

function parseWorktreePaths(porcelain: string): string[] {
  const paths: string[] = [];
  for (const line of porcelain.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      paths.push(line.slice("worktree ".length).trim());
    }
  }
  return paths;
}
