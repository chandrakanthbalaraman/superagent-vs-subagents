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
