import type { AuditRowChangeView } from '@hiflow/shared-types';

export interface ChangeLine {
  column: string;
  /** Update only: the value before. */
  before?: string;
  /** Insert and delete: the value; update: the value after. */
  after: string;
}

const NULL_TEXT = 'null';

/** A stored value as text. Everything is text: nothing here is ever treated as markup. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return NULL_TEXT;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function isPair(value: unknown): value is [unknown, unknown] {
  return Array.isArray(value) && value.length === 2;
}

/**
 * The lines of one row change. An insert lists `column: new`, a delete `column: old`, and an
 * update `column: old → new` (the API sends `[old, new]`). Columns are sorted by name so the
 * same change always reads the same.
 */
export function describeChanges(
  change: Pick<AuditRowChangeView, 'op' | 'changes'>,
): ChangeLine[] {
  return Object.keys(change.changes)
    .sort((a, b) => a.localeCompare(b))
    .map((column) => {
      const value = change.changes[column];
      if (change.op === 'U' && isPair(value)) {
        return {
          column,
          before: formatValue(value[0]),
          after: formatValue(value[1]),
        };
      }
      return { column, after: formatValue(value) };
    });
}
