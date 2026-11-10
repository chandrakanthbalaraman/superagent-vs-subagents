import { executeSuperagent } from "./lib/execute-superagent.js";

try {
  const code = await executeSuperagent(process.argv.slice(2));
  process.exit(code);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
