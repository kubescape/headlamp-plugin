export type CsvValue = string | number | boolean | null | undefined;

// Spreadsheets run cells starting with these characters as formulas
const formulaPrefix = /^[=+\-@\t\r]/;

function csvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && formulaPrefix.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Formats a header and rows as CSV (RFC 4180), with CRLF line endings. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map(row => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
