export type TicketStatus = "draft" | "ready" | "done";
export type TicketMode = "solo" | "team";

export type Ticket = {
  id: string;
  title: string;
  status: TicketStatus;
  mode: TicketMode;
  runsAlongside: string[];
  waitsFor: string[];
};

const HEADERS = ["id", "title", "status", "mode", "runs alongside", "waits for"];

export function parseBoard(markdown: string): Ticket[] {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));
  const header = lines[0];
  if (header === undefined || lines.length < 2) {
    throw new Error("specs/board.md needs a markdown table.");
  }
  const headerCells = splitRow(header);
  if (headerCells.join("|") !== HEADERS.join("|")) {
    throw new Error(`Board header must be: ${HEADERS.join(" | ")}`);
  }

  const tickets: Ticket[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(2)) {
    const cells = splitRow(line);
    if (cells.length !== HEADERS.length) {
      throw new Error(`Board row has ${cells.length} columns, expected ${HEADERS.length}: ${line}`);
    }
    const [id, title, statusCell, modeCell, alongside, waits] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (seen.has(id)) {
      throw new Error(`Duplicate ticket id ${id}`);
    }
    seen.add(id);
    tickets.push({
      id,
      title,
      status: parseStatus(statusCell),
      mode: parseMode(modeCell),
      runsAlongside: splitList(alongside),
      waitsFor: splitList(waits),
    });
  }
  return tickets;
}

function splitRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function splitList(cell: string): string[] {
  if (cell === "" || cell === "-" || cell === "—") {
    return [];
  }
  return cell
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== "-");
}

function parseStatus(value: string): TicketStatus {
  switch (value) {
    case "draft":
    case "ready":
    case "done":
      return value;
    default:
      throw new Error(`Unknown ticket status "${value}". Expected draft, ready, or done.`);
  }
}

function parseMode(value: string): TicketMode {
  switch (value) {
    case "solo":
    case "team":
      return value;
    default:
      throw new Error(`Unknown ticket mode "${value}". Expected solo or team.`);
  }
}
