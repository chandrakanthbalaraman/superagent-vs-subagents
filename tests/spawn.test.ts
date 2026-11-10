import { describe, expect, it } from "vitest";
import { runCommand } from "../scripts/lib/spawn.js";

describe("command timeout", () => {
  it("kills a process that outlives the wall-clock timeout", async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
      cwd: process.cwd(),
      timeoutMs: 200,
    });

    expect(result.timedOut).toBe(true);
    expect(result.code).toBeNull();
    expect(result.stderr).toContain("wall-clock timeout");
  });

  it("does not time out a process that exits first", async () => {
    const result = await runCommand({
      command: process.execPath,
      args: ["-e", "process.stdout.write('ok')"],
      cwd: process.cwd(),
      timeoutMs: 5000,
    });

    expect(result.timedOut).toBe(false);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("ok");
  });
});
