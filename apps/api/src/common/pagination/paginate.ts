import type { Paginated } from '@hiflow/shared-types';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

// The shape lives in shared-types so the web app reads the same one. Re-exported because
// the services import it from here.
export type { PageMeta, Paginated } from '@hiflow/shared-types';

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
