import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number,
  limit: number,
): Promise<Paginated<T>> {
  const [items, total] = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return toPaginated(items, total, page, limit);
}

/** Wraps user input for a case-insensitive "contains" match (ILIKE). */
export function containsPattern(search: string): string {
  // Escape LIKE wildcards so a user typing "50%" searches for the literal text.
  return `%${search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
