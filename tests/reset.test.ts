import { describe, expect, it } from "vitest";
import { planReset } from "../scripts/lib/reset.js";

describe("reset planner", () => {
  it("removes only worktrees under .worktrees and ticket branches", () => {
    const plan = planReset({
      worktreePorcelain: `
worktree /repo
HEAD abc
branch refs/heads/main

worktree /repo/.worktrees/001-search
HEAD def
branch refs/heads/ticket/001-search

worktree /repo/.worktrees/integrate
HEAD ghi
detached
`,
      branches: ["main", "ticket/001-search", "ticket/002-favorites", "cursor/other"],
      repoRoot: "/repo",
    });

    expect(plan.worktreeRemovals).toEqual([
      "/repo/.worktrees/001-search",
      "/repo/.worktrees/integrate",
    ]);
    expect(plan.branchDeletions).toEqual(["ticket/001-search", "ticket/002-favorites"]);
  });
});
