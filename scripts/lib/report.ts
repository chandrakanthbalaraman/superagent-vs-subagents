export type WorkerReport = {
  status: "done" | "blocked" | null;
  evalFirstTry: boolean | null;
  tests: "pass" | "fail" | null;
  summary: string | null;
};

export function parseWorkerReport(text: string): WorkerReport {
  let status: WorkerReport["status"] = null;
  let evalFirstTry: boolean | null = null;
  let tests: WorkerReport["tests"] = null;
  let summary: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const match = /^(status|eval_first_try|tests|summary):\s*(.*)$/.exec(line.trim());
    if (match === null) {
      continue;
    }
    const key = match[1];
    const value = match[2] ?? "";
    if (key === "status") {
      status = parseStatus(value);
    } else if (key === "eval_first_try") {
      evalFirstTry = parseBool(value);
    } else if (key === "tests") {
      tests = parseTests(value);
    } else if (key === "summary") {
      summary = value;
    }
  }

  return { status, evalFirstTry, tests, summary };
}

function parseStatus(value: string): WorkerReport["status"] {
  switch (value) {
    case "done":
    case "blocked":
      return value;
    default:
      return null;
  }
}

function parseBool(value: string): boolean | null {
  switch (value) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      return null;
  }
}

function parseTests(value: string): WorkerReport["tests"] {
  switch (value) {
    case "pass":
    case "fail":
      return value;
    default:
      return null;
  }
}
