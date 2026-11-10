import { describe, expect, it } from "vitest";
import { buildAgentCommand } from "../scripts/lib/agent-command.js";
import { buildClaudeArgs } from "../scripts/lib/claude-command.js";
import { buildCodexArgs } from "../scripts/lib/codex-command.js";
import { assembleCodexPrompt } from "../scripts/lib/codex-prompt.js";
import { readLaunchOptions, type LaunchOptions } from "../scripts/lib/launch-options.js";
import { parseFlags } from "../scripts/lib/args.js";

const ALLOWED = new Set([
  "--dry-run",
  "--agent-cli",
  "--timeout-seconds",
  "--permission-mode",
  "--max-turns",
]);

describe("Codex command builder", () => {
  it("builds a headless exec command for unattended edits", () => {
    const args = buildCodexArgs({
      prompt: "Implement the ticket.",
      permissionMode: "acceptEdits",
      additionalDirs: ["/repo/runs/stamp/001-search"],
    });

    expect(args).toEqual([
      "exec",
      "--json",
      "--color",
      "never",
      "--approve-for-me",
      "--add-dir",
      "/repo/runs/stamp/001-search",
      "Implement the ticket.",
    ]);
    expect(args).not.toContain("--sandbox");
    expect(args).not.toContain("--full-auto");
    expect(args).not.toContain("--max-turns");
    expect(args).not.toContain("--agent");
    expect(args).not.toContain("--allowedTools");
    expect(args).not.toContain("-p");
  });

  it("puts resume before the prompt and keeps parent flags in front", () => {
    const args = buildCodexArgs({
      prompt: "retry",
      permissionMode: "acceptEdits",
      resumeSessionId: "sess-1",
      additionalDirs: ["/repo/runs/a", "/repo/runs/b"],
    });

    expect(args).toEqual([
      "exec",
      "--json",
      "--color",
      "never",
      "--approve-for-me",
      "--add-dir",
      "/repo/runs/a",
      "--add-dir",
      "/repo/runs/b",
      "resume",
      "sess-1",
      "retry",
    ]);
    expect(args.indexOf("resume")).toBeLessThan(args.indexOf("sess-1"));
    expect(args.indexOf("--approve-for-me")).toBeLessThan(args.indexOf("resume"));
  });

  it("maps bypassPermissions to the documented unsandboxed flag", () => {
    const args = buildCodexArgs({
      prompt: "go",
      permissionMode: "bypassPermissions",
    });

    expect(args).toContain("--dangerously-bypass-approvals-and-sandbox");
    expect(args).not.toContain("--approve-for-me");
  });

  it("refuses Claude permission modes that have no Codex flag", () => {
    expect(() => buildCodexArgs({ prompt: "go", permissionMode: "plan" })).toThrow(/permission mode/i);
    expect(() => buildCodexArgs({ prompt: "go", permissionMode: "dontAsk" })).toThrow(/approve-for-me/);
  });

  it("keeps the Claude argv identical when the backend is claude", () => {
    const launch: LaunchOptions = {
      dryRun: true,
      help: false,
      agentCli: "claude",
      codexTimeoutSeconds: null,
      permissionMode: "acceptEdits",
      maxTurns: 12,
      maxParallel: 3,
      allowedTools: "Read,Edit,Write,Bash",
      forwardSubagentText: false,
      bare: false,
    };
    const built = buildAgentCommand({
      launch,
      prompt: "Implement the ticket.",
      name: "worker-001-search",
      agent: "worker",
      additionalDirs: ["/repo/runs/stamp/001-search"],
      appendSystemPromptFile: "subagents/team/orchestrator.md",
      resumeSessionId: "sess-1",
    });

    expect(launch.agentCli).toBe("claude");
    expect(launch.codexTimeoutSeconds).toBeNull();
    expect(built.command).toBe("claude");
    expect(built.timeoutMs).toBeNull();
    expect(built.prompt).toBe("Implement the ticket.");
    expect(built.args).toEqual(
      buildClaudeArgs({
        prompt: "Implement the ticket.",
        permissionMode: "acceptEdits",
        maxTurns: 12,
        name: "worker-001-search",
        agent: "worker",
        allowedTools: "Read,Edit,Write,Bash",
        additionalDirs: ["/repo/runs/stamp/001-search"],
        appendSystemPromptFile: "subagents/team/orchestrator.md",
        resumeSessionId: "sess-1",
      }),
    );
  });

  it("selects Codex from the flag or SUPERAGENT_AGENT_CLI and applies the wall-clock timeout", () => {
    const fromFlag = readLaunchOptions(parseFlags(["--agent-cli", "codex", "--timeout-seconds", "45"], ALLOWED));
    expect(fromFlag.agentCli).toBe("codex");
    expect(fromFlag.codexTimeoutSeconds).toBe(45);

    const previous = process.env.SUPERAGENT_AGENT_CLI;
    const previousTimeout = process.env.SUPERAGENT_TIMEOUT_SECONDS;
    process.env.SUPERAGENT_AGENT_CLI = "codex";
    delete process.env.SUPERAGENT_TIMEOUT_SECONDS;
    try {
      const fromEnv = readLaunchOptions(parseFlags([], ALLOWED));
      expect(fromEnv.agentCli).toBe("codex");
      expect(fromEnv.codexTimeoutSeconds).toBe(1800);
      const disabled = readLaunchOptions(parseFlags(["--timeout-seconds", "0"], ALLOWED));
      expect(disabled.codexTimeoutSeconds).toBeNull();
      const flagWins = readLaunchOptions(parseFlags(["--agent-cli", "claude"], ALLOWED));
      expect(flagWins.agentCli).toBe("claude");
      expect(flagWins.codexTimeoutSeconds).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.SUPERAGENT_AGENT_CLI;
      } else {
        process.env.SUPERAGENT_AGENT_CLI = previous;
      }
      if (previousTimeout === undefined) {
        delete process.env.SUPERAGENT_TIMEOUT_SECONDS;
      } else {
        process.env.SUPERAGENT_TIMEOUT_SECONDS = previousTimeout;
      }
    }
  });

  it("inlines the role file because Codex has no --agent flag", () => {
    const prompt = assembleCodexPrompt({
      roleMarkdown: "---\nname: worker\n---\n\nYou are one worker.",
      delegationNote: "Spawn only when asked.",
      taskPrompt: "Ticket: 001-search",
    });

    expect(prompt).toContain("no --agent flag");
    expect(prompt).toContain("You are one worker.");
    expect(prompt).toContain("Spawn only when asked.");
    expect(prompt.endsWith("Ticket: 001-search")).toBe(true);
  });
});
