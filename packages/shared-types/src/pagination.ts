/** What every list endpoint answers with besides its rows (business flow 1.5). */
export interface PageMeta {
  page: number;
  limit: number;
  /** Rows matching the filters across all pages. */
  total: number;
  /** At least 1, even for an empty list. */
  totalPages: number;
}

/** The body of a list endpoint: `{ items, meta }`. */
export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}
