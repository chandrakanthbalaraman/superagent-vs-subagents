import { readFileSync } from "node:fs";
import path from "node:path";

export const CODEX_PLAIN_DELEGATION_NOTE = [
  "Codex spawns a subagent only when you explicitly tell it to spawn one.",
  "You may spawn one for a narrow lookup. You do not have to.",
  "Do not spawn the router, worker, merger, checker, or watchdog roles.",
].join(" ");

export const CODEX_TEAM_DELEGATION_NOTE = [
  "Spawn Codex subagents by name.",
  "The project agents are planner, implementer, test-writer, and reviewer, defined in .codex/agents.",
  "Spawn the planner first.",
  "Then, for each ticket, spawn the implementer, the test-writer, and the reviewer, and wait for that ticket's subagents before starting the next ticket.",
  "Do not spawn router, worker, merger, checker, or watchdog.",
].join(" ");

export function assembleCodexPrompt(input: {
  taskPrompt: string;
  roleMarkdown?: string;
  extraInstructions?: string;
  extraInstructionsLabel?: string;
  delegationNote?: string;
}): string {
  const parts: string[] = [];
  if (input.roleMarkdown !== undefined) {
    parts.push(
      [
        "Codex has no --agent flag. Follow this role file, which the runner inlined:",
        input.roleMarkdown.trimEnd(),
      ].join("\n"),
    );
  }
  if (input.extraInstructions !== undefined) {
    const source =
      input.extraInstructionsLabel === undefined
        ? "the following instructions"
        : input.extraInstructionsLabel;
    parts.push(
      [
        `Codex has no --append-system-prompt-file flag. The runner inlined ${source}.`,
        "Where those instructions mention Claude Code, apply the same rules and spawn Codex subagents instead of a Claude Agent tool.",
        input.extraInstructions.trimEnd(),
      ].join("\n"),
    );
  }
  if (input.delegationNote !== undefined) {
    parts.push(input.delegationNote);
  }
  parts.push(input.taskPrompt);
  return parts.join("\n\n");
}

export function readRoleMarkdown(repoRoot: string, agent: string): string {
  const file = path.join(repoRoot, ".claude", "agents", `${agent}.md`);
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Error(`Codex has no --agent flag, and the role file ${file} could not be read.`);
  }
}

export function readTextFile(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Error(`Could not read ${file} to inline it into the Codex prompt.`);
  }
}
