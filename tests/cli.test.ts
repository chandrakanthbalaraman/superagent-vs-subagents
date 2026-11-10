import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");

function runTsx(
  args: string[],
  env: NodeJS.ProcessEnv = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, ...args], {
      cwd: root,
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

describe("runner dry-run", () => {
  it("prints the super-agent commands without starting Claude or creating worktrees", async () => {
    const result = await runTsx(["scripts/run-superagent.ts", "--dry-run"], {
      PATH: "/usr/bin:/bin",
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Dry run");
    expect(result.stdout).toContain("no timings");
    expect(result.stdout).toContain("--output-format");
    expect(result.stdout).toContain("stream-json");
    expect(result.stdout).toContain("--permission-mode");
    expect(result.stdout).toContain("acceptEdits");
    expect(result.stdout).toContain("--allowedTools");
    expect(result.stdout).toContain("Read,Edit,Write,Bash");
    expect(result.stdout).toContain("--max-turns");
    expect(result.stdout).toContain("--add-dir");
    expect(result.stdout).toContain("--agent");
    expect(result.stdout).toContain("worker");
    expect(result.stdout).toContain("001-search");
    expect(result.stdout).toContain("004-pagination");
    expect(result.stdout).toContain("npm test");
    expect(result.stdout).toContain("watchdog");
    expect(result.stdout).toContain("checker");
    expect(result.stdout).not.toContain("--headless");
    expect(result.stdout).not.toContain("--bare");
    expect(result.stdout.toLowerCase()).not.toContain("planted bug");
    expect(existsSync(path.join(root, ".worktrees"))).toBe(false);
  });

  it("shows that pagination waits for search", async () => {
    const result = await runTsx([
      "scripts/run-superagent.ts",
      "--dry-run",
      "--ticket",
      "004-pagination",
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("004-pagination");
    expect(result.stdout).toContain("waits for");
    expect(result.stdout).toContain("001-search");
  });

  it("refuses a real super-agent run when claude is not on PATH", async () => {
    const result = await runTsx(["scripts/run-superagent.ts"], { PATH: "/usr/bin:/bin" });
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/claude/i);
    expect(existsSync(path.join(root, ".worktrees"))).toBe(false);
  });

  it("prints both subagent setups", async () => {
    const plain = await runTsx(["scripts/run-subagents.ts", "--dry-run", "--mode", "plain"]);
    expect(plain.code).toBe(0);
    expect(plain.stdout).toContain("Dry run");
    expect(plain.stdout).toContain("001-search");
    expect(plain.stdout).toContain("--output-format");
    expect(plain.stdout).not.toContain("\n  --agent");

    const team = await runTsx(["scripts/run-subagents.ts", "--dry-run", "--mode", "team"]);
    expect(team.code).toBe(0);
    expect(team.stdout).toContain("--append-system-prompt-file");
    expect(team.stdout).toContain("orchestrator.md");
    expect(team.stdout).toContain("planner");
  });

  it("prints help, an empty metrics report, and a reset dry-run", async () => {
    const help = await runTsx(["scripts/run-superagent.ts", "--help"]);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("--dry-run");

    const metrics = await runTsx(["scripts/metrics.ts", "--timings", path.join(root, "missing-timings.json")]);
    expect(metrics.code).toBe(0);
    expect(metrics.stdout).toContain("No timings file found");

    const reset = await runTsx(["scripts/reset-run.ts", "--dry-run"]);
    expect(reset.code).toBe(0);
    expect(reset.stdout.toLowerCase()).toContain("dry run");
  });
});
