const VALUE_FLAGS = new Set([
  "--ticket",
  "--only",
  "--mode",
  "--permission-mode",
  "--max-turns",
  "--max-budget-usd",
  "--max-parallel",
  "--allowed-tools",
  "--permission-prompts",
  "--stale-seconds",
  "--runs",
  "--timings",
]);

export function parseFlags(argv: string[], allowed: ReadonlySet<string>): Map<string, string | true> {
  const flags = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (token === "--") {
      break;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}".`);
    }
    const equals = token.indexOf("=");
    const name = equals === -1 ? token : token.slice(0, equals);
    if (!allowed.has(name)) {
      throw new Error(`Unknown flag "${name}". Pass --help to see the flags for this command.`);
    }
    if (VALUE_FLAGS.has(name)) {
      const inline = equals === -1 ? undefined : token.slice(equals + 1);
      const value = inline ?? argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Flag ${name} needs a value.`);
      }
      if (inline === undefined) {
        index += 1;
      }
      flags.set(name, value);
    } else if (equals !== -1) {
      throw new Error(`Flag ${name} does not take a value.`);
    } else {
      flags.set(name, true);
    }
  }
  return flags;
}

export function flagString(flags: Map<string, string | true>, name: string): string | undefined {
  const value = flags.get(name);
  return typeof value === "string" ? value : undefined;
}

export function requirePositiveInt(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}
