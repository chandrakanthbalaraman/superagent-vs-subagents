export function shellQuote(value: string): string {
  if (value === "") {
    return "''";
  }
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function formatArgv(command: string, args: string[]): string {
  return [command, ...args.map(shellQuote)].join(" \\\n  ");
}
