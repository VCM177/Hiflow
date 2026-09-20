export interface CsvColumn<Row> {
  key: Extract<keyof Row, string>;
  label: string;
}

/** Excel opens a UTF-8 file with Vietnamese text correctly only with this marker. */
export const UTF8_BOM = '﻿';

// A cell starting with one of these is read as a formula by spreadsheets, so a
// value like `=HYPERLINK("http://evil")` typed into a title would execute.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();

  return JSON.stringify(value);
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';

  let text = stringify(value);

  // Numbers are safe as they are; only text can carry a formula.
  if (typeof value === 'string' && FORMULA_TRIGGERS.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<Row>(columns: CsvColumn<Row>[], rows: Row[]): string {
  const header = columns.map((c) => cell(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => cell(row[c.key])).join(','),
  );

  return UTF8_BOM + [header, ...body].join('\r\n') + '\r\n';
}
