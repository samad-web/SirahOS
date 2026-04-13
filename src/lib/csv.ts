/**
 * Tiny CSV helper — no external deps.
 *
 * Accepts an array of plain objects and a column definition, returns a
 * proper RFC 4180-ish CSV string:
 *   - Values containing commas, quotes, or newlines are wrapped in quotes
 *   - Embedded quotes are doubled
 *   - Trailing CRLF after every row
 *
 * Why hand-rolled: a CSV export library (papaparse, fast-csv) is ~30KB of
 * client JS we don't need. Our use case is "dump 100-1000 rows to a file"
 * which this does cleanly in under 40 lines.
 */

export type CSVColumn<T> = {
  header: string;
  /** Extract the cell value from a row. Return any primitive — we'll stringify. */
  value: (row: T) => string | number | boolean | null | undefined;
};

function escapeCell(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = typeof raw === "string" ? raw : String(raw);
  // Only wrap in quotes if we actually need to.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const header = columns.map(c => escapeCell(c.header)).join(",");
  const body = rows
    .map(row => columns.map(c => escapeCell(c.value(row))).join(","))
    .join("\r\n");
  return rows.length > 0 ? `${header}\r\n${body}\r\n` : `${header}\r\n`;
}

/**
 * Trigger a browser download of the given CSV string.
 * `filename` should end in ".csv" — we'll add it if missing.
 */
export function downloadCSV(csv: string, filename: string) {
  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  // Excel-friendly: prepend a UTF-8 BOM so Excel on Windows doesn't mangle
  // non-ASCII characters (e.g. ₹ or accented names).
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a tick to start the download before we revoke.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Convenience: generate a filename with today's date suffix (YYYY-MM-DD). */
export function datedFilename(base: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${base}-${today}.csv`;
}
