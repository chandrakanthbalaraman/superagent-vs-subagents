import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBoard } from "../scripts/lib/board.js";
import { planWaves } from "../scripts/lib/scheduler.js";

const root = path.resolve(import.meta.dirname, "..");

describe("ticket board", () => {
  it("parses status, mode, partners, and dependencies", () => {
    const tickets = parseBoard(`
| id | title | status | mode | runs alongside | waits for |
| --- | --- | --- | --- | --- | --- |
| 001-search | Search recipes | ready | solo | 002-favorites, 003-tags | - |
| 002-favorites | Favorite a recipe | draft | team | | 001-search |
| 004-pagination | Paginate | done | solo | - | 001-search |
`);
    expect(tickets).toEqual([
      {
        id: "001-search",
        title: "Search recipes",
        status: "ready",
        mode: "solo",
        runsAlongside: ["002-favorites", "003-tags"],
        waitsFor: [],
      },
      {
        id: "002-favorites",
        title: "Favorite a recipe",
        status: "draft",
        mode: "team",
        runsAlongside: [],
        waitsFor: ["001-search"],
      },
      {
        id: "004-pagination",
        title: "Paginate",
        status: "done",
        mode: "solo",
        runsAlongside: [],
        waitsFor: ["001-search"],
      },
    ]);
  });

  it("rejects an unknown status", () => {
    expect(() =>
      parseBoard(`
| id | title | status | mode | runs alongside | waits for |
| --- | --- | --- | --- | --- | --- |
| 001-search | Search | later | solo | | |
`),
    ).toThrow(/status/i);
  });

  it("plans ready tickets so a dependency runs in a later wave", () => {
    const tickets = parseBoard(`
| id | title | status | mode | runs alongside | waits for |
| --- | --- | --- | --- | --- | --- |
| 001-search | Search | ready | solo | 002-favorites | |
| 002-favorites | Favorites | ready | solo | 001-search | |
| 004-pagination | Pages | ready | solo | | 001-search |
| 009-later | Later | draft | solo | | |
`);
    const plan = planWaves(tickets);
    expect(plan.waves.map((wave) => wave.map((ticket) => ticket.id))).toEqual([
      ["001-search", "002-favorites"],
      ["004-pagination"],
    ]);
    expect(plan.blocked).toEqual([]);
  });

  it("reports a ticket blocked when its dependency is not ready or done", () => {
    const tickets = parseBoard(`
| id | title | status | mode | runs alongside | waits for |
| --- | --- | --- | --- | --- | --- |
| 001-search | Search | draft | solo | | |
| 004-pagination | Pages | ready | solo | | 001-search |
`);
    const plan = planWaves(tickets);
    expect(plan.waves).toEqual([]);
    expect(plan.blocked.map((ticket) => ticket.id)).toEqual(["004-pagination"]);
  });

  it("keeps the committed board and ticket folders in sync", () => {
    const markdown = readFileSync(path.join(root, "specs/board.md"), "utf8");
    const tickets = parseBoard(markdown);
    const ready = tickets.filter((ticket) => ticket.status === "ready");
    expect(ready.map((ticket) => ticket.id)).toEqual([
      "001-search",
      "002-favorites",
      "003-tags",
      "004-pagination",
      "005-input-validation",
    ]);
    const plan = planWaves(tickets);
    expect(plan.blocked).toEqual([]);
    expect(plan.waves[0]?.map((ticket) => ticket.id)).toEqual([
      "001-search",
      "002-favorites",
      "003-tags",
      "005-input-validation",
    ]);
    expect(plan.waves[1]?.map((ticket) => ticket.id)).toEqual(["004-pagination"]);

    for (const ticket of tickets) {
      const dir = path.join(root, "specs/tickets", ticket.id);
      expect(readFileSync(path.join(dir, "spec.md"), "utf8").length).toBeGreaterThan(80);
      expect(readFileSync(path.join(dir, "eval.md"), "utf8")).toMatch(/npm test/);
    }
  });
});
