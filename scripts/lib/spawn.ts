import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

export function runCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  logPath?: string;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const log = input.logPath === undefined ? null : createWriteStream(input.logPath, { flags: "a" });
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      log?.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      log?.write(chunk);
    });
    child.on("error", (error) => {
      log?.end();
      reject(error);
    });
    child.on("exit", (code) => {
      log?.end();
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
      });
    });
  });
}
