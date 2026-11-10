/**
 * Parse `codex exec --json` JSONL.
 *
 * Event names match the noninteractive docs (`thread.started`, `turn.completed`,
 * `turn.failed`, `item.*`, `error`) and the CLI schema in openai/codex
 * `codex-rs/exec/src/exec_events.rs` as of 2026-11-10.
 *
 * A delegation is one distinct `item.*` whose item `type` is `collab_tool_call`
 * and whose `tool` is `spawn_agent`. Started, updated, and completed events for
 * the same item id count once. `send_input`, `wait`, and `close_agent` do not.
 * When the stream has no recognized Codex event, delegations stays null.
 * A recognized stream with no spawn item records 0. That 0 is "no spawn_agent
 * item was present", not a guess that the model avoided delegation.
 *
 * Usage is the last `turn.completed` object's numeric fields, copied through.
 * Missing fields are left out. Token counts are not summed and cost is not
 * derived. This module does not report a dollar cost.
 */

const CODEX_EVENT_TYPES = new Set([
  "thread.started",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "item.started",
  "item.updated",
  "item.completed",
  "error",
]);

const ITEM_EVENT_TYPES = new Set(["item.started", "item.updated", "item.completed"]);

export type CodexEventMeta = {
  sessionId: string | null;
  usage: Record<string, number> | null;
  failed: boolean;
  failureMessage: string | null;
  delegations: number | null;
};

export function readCodexEventMeta(stream: string): CodexEventMeta {
  let sessionId: string | null = null;
  let usage: Record<string, number> | null = null;
  let failed = false;
  const failureMessages: string[] = [];
  const spawnIds = new Set<string>();
  let anonymousSpawns = 0;
  let sawCodexEvent = false;

  for (const event of parseJsonLines(stream)) {
    if (!isRecord(event) || typeof event.type !== "string" || !CODEX_EVENT_TYPES.has(event.type)) {
      continue;
    }
    sawCodexEvent = true;
    if (event.type === "thread.started" && typeof event.thread_id === "string") {
      sessionId = event.thread_id;
    }
    if (event.type === "turn.completed") {
      const nextUsage = numericFields(event.usage);
      if (nextUsage !== null) {
        usage = nextUsage;
      }
    }
    if (event.type === "turn.failed") {
      failed = true;
      const message = errorMessage(event.error);
      if (message !== null) {
        failureMessages.push(message);
      }
    }
    if (event.type === "error") {
      failed = true;
      const message = typeof event.message === "string" ? event.message : null;
      if (message !== null) {
        failureMessages.push(message);
      }
    }
    if (ITEM_EVENT_TYPES.has(event.type) && isSpawnAgent(event.item)) {
      const id = itemId(event.item);
      if (id === null) {
        if (event.type === "item.completed") {
          anonymousSpawns += 1;
        }
      } else {
        spawnIds.add(id);
      }
    }
  }

  return {
    sessionId,
    usage,
    failed,
    failureMessage: failureMessages.length === 0 ? null : failureMessages.join("; "),
    delegations: sawCodexEvent ? spawnIds.size + anonymousSpawns : null,
  };
}

function isSpawnAgent(item: unknown): boolean {
  return isRecord(item) && item.type === "collab_tool_call" && item.tool === "spawn_agent";
}

function itemId(item: unknown): string | null {
  if (!isRecord(item) || typeof item.id !== "string" || item.id === "") {
    return null;
  }
  return item.id;
}

function errorMessage(value: unknown): string | null {
  if (!isRecord(value) || typeof value.message !== "string" || value.message === "") {
    return null;
  }
  return value.message;
}

function numericFields(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) {
    return null;
  }
  const usage: Record<string, number> = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === "number" && Number.isFinite(field)) {
      usage[key] = field;
    }
  }
  return Object.keys(usage).length === 0 ? null : usage;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
