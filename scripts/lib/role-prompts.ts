import type { Ticket } from "./board.js";
import { buildRoster } from "./prompt.js";

export function buildMergerPrompt(input: { tickets: Ticket[]; reportPath: string }): string {
  const branches = input.tickets
    .filter((ticket) => ticket.status === "ready" || ticket.status === "done")
    .map((ticket) => `ticket/${ticket.id}`)
    .join("\n");
  return [
    "You are the merger for one super-agent run. You integrate finished ticket branches.",
    "You do not start new features.",
    "",
    "Branches to merge, in this order:",
    branches,
    "",
    "For each branch that exists, merge it into the current branch.",
    "If a branch was never created, skip it and say so.",
    "Resolve conflicts in src/app.ts and src/types.ts by keeping every feature:",
    "GET /recipes applies search (q), then favorite, then tag, then pagination.",
    "Do not rewrite src/search.ts while you are merging.",
    "Run npm test. If it fails, fix only integration damage, then run npm test again.",
    "",
    "Write this report:",
    input.reportPath,
    "merged: <branch names, or none>",
    "tests: pass or fail",
    "summary: <one line>",
  ].join("\n");
}

export function buildCheckerPrompt(input: { findingsPath: string }): string {
  return [
    "You are the checker. You do not implement tickets.",
    "Compare the Recipe Box API with docs/prd.md.",
    "Read src/ and tests/ so you can see what the suite already covers.",
    "Start the server with npm start, exercise the HTTP API, then stop the server.",
    "Look for behavior the tests do not cover. Try the query parameters the code accepts.",
    "Skip README.md and every root-level dotfile. Judge the code and the HTTP responses yourself.",
    "Do not merge branches and do not edit product code.",
    "",
    "Write findings to:",
    input.findingsPath,
    "List each mismatch with the request you sent and the response you got.",
    "If you find nothing, say that you found nothing. Do not invent a bug to fill the file.",
  ].join("\n");
}

export function buildPlainSessionPrompt(tickets: Ticket[], reportPath: string): string {
  return [
    "You are one Claude Code session. This is the subagent lab, plain setup.",
    "Finish every ready ticket below. They share this working tree.",
    "You may delegate with subagents. The harness counts Agent tool calls in the transcript.",
    "Do not take on the super-agent router, worker, merger, checker, or watchdog roles.",
    "Skip README.md and every root-level dotfile.",
    "",
    "Ready tickets:",
    buildRoster(tickets.filter((ticket) => ticket.status === "ready")),
    "",
    "For each ticket, read specs/tickets/<id>/spec.md and eval.md before editing.",
    "When you finish, write:",
    reportPath,
    "Use one block per ticket with these lines:",
    "ticket: <id>",
    "status: done",
    "eval_first_try: <true or false>",
    "tests: <pass or fail>",
    "summary: <one line>",
  ].join("\n");
}

export function buildTeamSessionPrompt(tickets: Ticket[], reportPath: string): string {
  return [
    "You are one Claude Code session. This is the subagent lab, team setup.",
    "Finish every ready ticket. Delegate the work to the project subagents named planner, implementer, test-writer, and reviewer.",
    "Do not delegate to router, worker, merger, checker, or watchdog.",
    "You coordinate. Prefer not to edit product code in the main session.",
    "Skip README.md and every root-level dotfile.",
    "",
    "Ready tickets:",
    buildRoster(tickets.filter((ticket) => ticket.status === "ready")),
    "",
    "When you finish, write:",
    reportPath,
    "Use one block per ticket with these lines:",
    "ticket: <id>",
    "status: done",
    "eval_first_try: <true or false>",
    "tests: <pass or fail>",
    "summary: <one line>",
  ].join("\n");
}
