import { describe, expect, it } from "vitest";
import { buildClaudeArgs, parsePermissionMode } from "../scripts/lib/claude-command.js";
import { buildWorkerPrompt } from "../scripts/lib/prompt.js";
import { parseWorkerReport } from "../scripts/lib/report.js";

describe("Claude Code command builder", () => {
  it("uses documented print-mode flags and does not invent a headless flag", () => {
    const args = buildClaudeArgs({
      prompt: "Implement the ticket.",
      permissionMode: "acceptEdits",
      maxTurns: 30,
      agent: "worker",
      name: "worker-001-search",
    });

    expect(args[0]).toBe("-p");
    expect(args[1]).toBe("Implement the ticket.");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--verbose");
    expect(args).toContain("--permission-mode");
    expect(args).toContain("acceptEdits");
    expect(args).toContain("--allowedTools");
    expect(args).toContain("Read,Edit,Write,Bash");
    expect(args).toContain("--max-turns");
    expect(args).toContain("30");
    expect(args).toContain("--agent");
    expect(args).toContain("worker");
    expect(args).not.toContain("--headless");
    expect(args).not.toContain("--dangerously-skip-permissions");
    expect(args).not.toContain("--yes");
    expect(args).not.toContain("--bare");
  });

  it("adds optional documented flags only when asked", () => {
    const args = buildClaudeArgs({
      prompt: "retry",
      permissionMode: "bypassPermissions",
      maxTurns: 10,
      agent: "worker",
      name: "worker-001-search",
      continueConversation: true,
      resumeSessionId: "sess-1",
      maxBudgetUsd: "2.50",
      appendSystemPromptFile: "subagents/team/orchestrator.md",
      forwardSubagentText: true,
      permissionPrompts: "none",
    });

    expect(args).toContain("--continue");
    expect(args).toContain("--resume");
    expect(args).toContain("sess-1");
    expect(args).toContain("--max-budget-usd");
    expect(args).toContain("2.50");
    expect(args).toContain("--append-system-prompt-file");
    expect(args).toContain("--forward-subagent-text");
    expect(args).toContain("--permission-prompts");
    expect(args).toContain("none");
  });

  it("accepts only permission modes from the Claude Code docs", () => {
    expect(parsePermissionMode("manual")).toBe("manual");
    expect(parsePermissionMode("acceptEdits")).toBe("acceptEdits");
    expect(() => parsePermissionMode("yolo")).toThrow(/permission mode/i);
  });
});

describe("worker prompt and report", () => {
  it("points at one ticket and hides nothing the worker should implement", () => {
    const solo = buildWorkerPrompt({
      ticketId: "001-search",
      title: "Search recipes",
      mode: "solo",
      specPath: "/repo/specs/tickets/001-search/spec.md",
      evalPath: "/repo/specs/tickets/001-search/eval.md",
      reportPath: "/repo/runs/stamp/001-search/report.md",
      heartbeatPath: "/repo/runs/stamp/001-search/heartbeat.json",
    });
    expect(solo).toContain("001-search");
    expect(solo).toContain("/repo/specs/tickets/001-search/spec.md");
    expect(solo).toContain("status: done");
    expect(solo).toContain("eval_first_try:");
    expect(solo).not.toMatch(/planted bug/i);

    const team = buildWorkerPrompt({
      ticketId: "002-favorites",
      title: "Favorites",
      mode: "team",
      specPath: "/spec.md",
      evalPath: "/eval.md",
      reportPath: "/report.md",
      heartbeatPath: "/heartbeat.json",
    });
    expect(team).toContain("subagent");
    expect(solo).not.toContain("split research");
  });

  it("reads machine-readable report lines and leaves blanks as unknown", () => {
    expect(
      parseWorkerReport(`
status: done
eval_first_try: true
tests: pass
summary: Search is case-insensitive now.
`),
    ).toEqual({
      status: "done",
      evalFirstTry: true,
      tests: "pass",
      summary: "Search is case-insensitive now.",
    });

    expect(parseWorkerReport("status: blocked\nsummary: Need a decision.\n")).toEqual({
      status: "blocked",
      evalFirstTry: null,
      tests: null,
      summary: "Need a decision.",
    });
  });
});
