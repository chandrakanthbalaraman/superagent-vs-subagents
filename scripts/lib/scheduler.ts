import type { Ticket } from "./board.js";

export type WavePlan = {
  waves: Ticket[][];
  blocked: Ticket[];
};

/**
 * Ready tickets whose waits-for are already done (or will be, in an earlier
 * wave of this plan) run together. A ticket whose dependency is still draft
 * stays in `blocked` instead of being started.
 */
export function planWaves(tickets: Ticket[]): WavePlan {
  const ready = tickets.filter((ticket) => ticket.status === "ready");
  const finished = new Set(tickets.filter((ticket) => ticket.status === "done").map((ticket) => ticket.id));
  const remaining = new Map(ready.map((ticket) => [ticket.id, ticket]));
  const waves: Ticket[][] = [];

  while (remaining.size > 0) {
    const wave = [...remaining.values()].filter((ticket) => ticket.waitsFor.every((id) => finished.has(id)));
    if (wave.length === 0) {
      break;
    }
    waves.push(wave);
    for (const ticket of wave) {
      remaining.delete(ticket.id);
      finished.add(ticket.id);
    }
  }

  return { waves, blocked: [...remaining.values()] };
}
