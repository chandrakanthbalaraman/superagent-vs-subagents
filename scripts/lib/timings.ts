export type TicketRunRecord = {
  id: string;
  wallClockMs: number;
  claudeExitCode: number | null;
  npmTestExitCode: number | null;
  testsPassing: boolean | null;
  delegations: number | null;
  evalFirstTry: boolean | null;
  sessionId: string | null;
  totalCostUsd: number | null;
  usage: unknown | null;
  humanInterventions: null;
  plantedBugFound: null;
};

export type RunTimings = {
  setup: string;
  startedAt: string;
  finishedAt: string;
  wallClockMs: number;
  tickets: TicketRunRecord[];
  humanInterventions: null;
  plantedBugFound: null;
  notes: string[];
};

export function blankTicket(id: string, wallClockMs: number): TicketRunRecord {
  return {
    id,
    wallClockMs,
    claudeExitCode: null,
    npmTestExitCode: null,
    testsPassing: null,
    delegations: null,
    evalFirstTry: null,
    sessionId: null,
    totalCostUsd: null,
    usage: null,
    humanInterventions: null,
    plantedBugFound: null,
  };
}
