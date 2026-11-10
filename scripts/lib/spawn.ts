import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";

export type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export function runCommand(input: {
  command: string;
  args: string[];
  cwd: string;
  logPath?: string;
  timeoutMs?: number;
}): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const log = input.logPath === undefined ? null : createWriteStream(input.logPath, { flags: "a" });
    let settled = false;
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (code: number | null) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (killTimer !== undefined) {
        clearTimeout(killTimer);
      }
      log?.end();
      resolve({
        code: timedOut ? code : (code ?? 1),
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        timedOut,
      });
    };

    const timer =
      input.timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            const note = `Runner wall-clock timeout after ${input.timeoutMs}ms. The process was killed.\n`;
            stderrChunks.push(Buffer.from(note));
            log?.write(note);
            child.kill("SIGTERM");
            killTimer = setTimeout(() => {
              child.kill("SIGKILL");
            }, 2000);
            killTimer.unref?.();
          }, input.timeoutMs);
    timer?.unref?.();

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      log?.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      log?.write(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (killTimer !== undefined) {
        clearTimeout(killTimer);
      }
      log?.end();
      reject(error);
    });
    child.on("exit", (code) => {
      finish(code);
    });
  });
}
