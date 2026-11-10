import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

export async function commandExists(name: string): Promise<boolean> {
  const pathValue = process.env.PATH ?? "";
  for (const directory of pathValue.split(path.delimiter)) {
    if (directory === "") {
      continue;
    }
    try {
      await access(path.join(directory, name), constants.X_OK);
      return true;
    } catch {
      // Try the next directory.
    }
  }
  return false;
}

export const MISSING_CLAUDE =
  "Claude Code CLI (`claude`) was not found on PATH. Install it, then run `claude auth login` or export ANTHROPIC_API_KEY. A dry run does not need the CLI: add --dry-run.\n";

export const MISSING_CODEX =
  "Codex CLI (`codex`) was not found on PATH. Install it, check `codex --version`, then run `codex login` or set CODEX_API_KEY for that process only. A dry run does not need the CLI: add --dry-run.\n";
