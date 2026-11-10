import { describe, expect, it } from "vitest";
import { readCodexEventMeta } from "../scripts/lib/codex-events.js";

function line(value: unknown): string {
  return JSON.stringify(value);
}

describe("Codex JSONL parsing", () => {
  it("reads the session id and the last turn's usage without inventing fields", () => {
    const stream = [
      line({ type: "thread.started", thread_id: "thread-1" }),
      line({ type: "turn.started" }),
      "not json",
      line({
        type: "turn.completed",
        usage: { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3, reasoning_output_tokens: 1 },
      }),
      line({ type: "thread.started", thread_id: "thread-2" }),
      line({ type: "turn.completed", usage: { input_tokens: 5, output_tokens: 2, note: "skip me" } }),
    ].join("\n");

    const meta = readCodexEventMeta(stream);
    expect(meta.sessionId).toBe("thread-2");
    expect(meta.usage).toEqual({ input_tokens: 5, output_tokens: 2 });
    expect(meta.usage).not.toHaveProperty("cached_input_tokens");
    expect(meta.usage).not.toHaveProperty("reasoning_output_tokens");
    expect(meta.failed).toBe(false);
    expect(JSON.stringify(meta)).not.toContain("cost");
  });

  it("does not add token counts across turns", () => {
    const stream = [
      line({ type: "turn.completed", usage: { input_tokens: 10, output_tokens: 4 } }),
      line({ type: "turn.completed", usage: { input_tokens: 3, output_tokens: 1 } }),
    ].join("\n");

    expect(readCodexEventMeta(stream).usage).toEqual({ input_tokens: 3, output_tokens: 1 });
  });

  it("detects turn.failed and top-level error events", () => {
    const failed = readCodexEventMeta(
      [
        line({ type: "thread.started", thread_id: "thread-9" }),
        line({ type: "turn.failed", error: { message: "sandbox denied the command" } }),
      ].join("\n"),
    );
    expect(failed.failed).toBe(true);
    expect(failed.failureMessage).toBe("sandbox denied the command");
    expect(failed.sessionId).toBe("thread-9");

    const streamError = readCodexEventMeta(line({ type: "error", message: "stream closed" }));
    expect(streamError.failed).toBe(true);
    expect(streamError.failureMessage).toBe("stream closed");

    const itemError = readCodexEventMeta(
      line({ type: "item.completed", item: { id: "e1", type: "error", message: "tool hiccup" } }),
    );
    expect(itemError.failed).toBe(false);
  });

  it("counts each spawn_agent item once and ignores other collab tools", () => {
    const stream = [
      line({ type: "thread.started", thread_id: "parent" }),
      line({
        type: "item.started",
        item: { id: "item_9", type: "collab_tool_call", tool: "spawn_agent", status: "in_progress" },
      }),
      line({
        type: "item.completed",
        item: { id: "item_9", type: "collab_tool_call", tool: "spawn_agent", status: "completed" },
      }),
      line({
        type: "item.completed",
        item: { id: "item_10", type: "collab_tool_call", tool: "send_input", status: "completed" },
      }),
      line({
        type: "item.completed",
        item: { id: "item_11", type: "collab_tool_call", tool: "spawn_agent", status: "completed" },
      }),
      line({ type: "item.completed", item: { id: "item_3", type: "agent_message", text: "done" } }),
    ].join("\n");

    expect(readCodexEventMeta(stream).delegations).toBe(2);
  });

  it("leaves the delegation count empty when the stream has no Codex events", () => {
    expect(readCodexEventMeta("")).toEqual({
      sessionId: null,
      usage: null,
      failed: false,
      failureMessage: null,
      delegations: null,
    });
    expect(readCodexEventMeta('{"type":"result","session_id":"claude"}').delegations).toBeNull();
  });

  it("records zero spawns when a Codex session produced events and no spawn_agent item", () => {
    const stream = [
      line({ type: "thread.started", thread_id: "thread-1" }),
      line({
        type: "turn.completed",
        usage: {
          input_tokens: 24763,
          cached_input_tokens: 24448,
          output_tokens: 122,
          reasoning_output_tokens: 0,
        },
      }),
    ].join("\n");

    const meta = readCodexEventMeta(stream);
    expect(meta.delegations).toBe(0);
    expect(meta.usage).toEqual({
      input_tokens: 24763,
      cached_input_tokens: 24448,
      output_tokens: 122,
      reasoning_output_tokens: 0,
    });
  });
});
