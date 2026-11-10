type JsonRecord = Record<string, unknown>;

export type ResultMeta = {
  sessionId: string | null;
  totalCostUsd: number | null;
  usage: unknown | null;
};

export function countDelegations(stream: string): number {
  let count = 0;
  for (const event of parseJsonLines(stream)) {
    for (const block of contentBlocks(event)) {
      if (isRecord(block) && block.type === "tool_use" && block.name === "Agent") {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * The headless docs say a JSON result includes `total_cost_usd`.
 * Some result events also include `usage` and `session_id`.
 * Fields that are absent stay null. This does not estimate tokens.
 */
export function readResultMeta(stream: string): ResultMeta {
  let sessionId: string | null = null;
  let totalCostUsd: number | null = null;
  let usage: unknown | null = null;

  for (const event of parseJsonLines(stream)) {
    if (!isRecord(event) || event.type !== "result") {
      continue;
    }
    if (typeof event.session_id === "string") {
      sessionId = event.session_id;
    }
    if (typeof event.total_cost_usd === "number") {
      totalCostUsd = event.total_cost_usd;
    } else if (typeof event.cost_usd === "number") {
      totalCostUsd = event.cost_usd;
    }
    if ("usage" in event && event.usage !== undefined) {
      usage = event.usage;
    }
  }

  return { sessionId, totalCostUsd, usage };
}

function parseJsonLines(stream: string): unknown[] {
  const events: unknown[] = [];
  for (const line of stream.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    try {
      events.push(JSON.parse(trimmed) as unknown);
    } catch {
      // Mixed logs can contain non-JSON lines. Skip them.
    }
  }
  return events;
}

function contentBlocks(event: unknown): unknown[] {
  if (!isRecord(event)) {
    return [];
  }
  if (Array.isArray(event.content)) {
    return event.content;
  }
  if (isRecord(event.message) && Array.isArray(event.message.content)) {
    return event.message.content;
  }
  return [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
