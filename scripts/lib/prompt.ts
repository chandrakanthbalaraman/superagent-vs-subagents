import type { Ticket, TicketMode } from "./board.js";

export function buildWorkerPrompt(input: {
  ticketId: string;
  title: string;
  mode: TicketMode;
  specPath: string;
  evalPath: string;
  reportPath: string;
  heartbeatPath: string;
}): string {
  return [
    "You are the worker for a single Recipe Box ticket.",
    "The router owns the conversation with the human. Do not ask the human questions.",
    "If the spec is missing a real product choice, stop and write status: blocked.",
    "",
    `Ticket: ${input.ticketId}`,
    `Title: ${input.title}`,
    `Mode: ${input.mode}`,
    `Spec: ${input.specPath}`,
    `Eval: ${input.evalPath}`,
    `Report file: ${input.reportPath}`,
    `Heartbeat file: ${input.heartbeatPath}`,
    "",
    modeNote(input.mode),
    "",
    "Read the spec and the eval. Change only what the spec allows.",
    "Skip README.md and every root-level dotfile. The spec is the assignment.",
    "Commit your work on the current branch. Do not push and do not merge.",
    "After each significant step, rewrite the heartbeat file as JSON:",
    '{"updatedAt":"<ISO-8601>","note":"<one line>"}',
    "",
    "When you stop, the report file must contain these lines:",
    "status: done",
    "eval_first_try: <true or false>",
    "tests: <pass or fail>",
    "summary: <one line>",
    "",
    "Use status: blocked instead of status: done when you need a human decision.",
    "eval_first_try is true only if the eval's checks passed on your first attempt.",
  ].join("\n");
}

export function buildRetryPrompt(ticketId: string): string {
  return [
    `The previous attempt on ${ticketId} failed.`,
    "Stay on this same ticket and this same checkout.",
    "Read the eval and your report, fix the gap, and update the report.",
    "Do not start a different ticket.",
  ].join("\n");
}

export function buildRoster(tickets: Ticket[]): string {
  return tickets
    .map((ticket) => `- ${ticket.id} (${ticket.status}, ${ticket.mode}): ${ticket.title}`)
    .join("\n");
}

function modeNote(mode: TicketMode): string {
  switch (mode) {
    case "solo":
      return "This ticket is solo. Do the work in this session. You may spawn a subagent only for a narrow lookup, not to hand the ticket off.";
    case "team":
      return "This ticket is team mode. You may split research, implementation, and tests across subagents. You still own the result and the report.";
    default: {
      const unexpected: never = mode;
      throw new Error(`Unknown mode ${String(unexpected)}`);
    }
  }
}
