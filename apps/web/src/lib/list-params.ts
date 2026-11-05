import { z } from 'zod';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const MAX_SEARCH = 100;

/**
 * Parameters every list shares (business flow 1.5). A bad value falls back to its
 * default instead of breaking the page: `catch` replaces anything that does not parse.
 */
export const listBaseShape = {
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).catch(DEFAULT_LIMIT),
  search: z.string().trim().max(MAX_SEARCH).catch(''),
  sortBy: z.string().max(64).optional().catch(undefined),
  sortDir: z.enum(['asc', 'desc']).catch('asc'),
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Reads the parameters from a URL. Each key is parsed with its own schema, so one
 * invalid filter is dropped and the others still apply. A key with no schema is ignored.
 */
export function parseListParams<TShape extends Record<string, z.ZodType>>(
  raw: RawSearchParams,
  shape: TShape,
): { [K in keyof TShape]: z.output<TShape[K]> } {
  const parsed: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    const schema = shape[key];
    const value = raw[key];
    // A repeated filter (?status=a&status=b) arrives as an array; schemas decide if that is valid.
    const result = schema.safeParse(value);
    parsed[key] = result.success ? result.data : undefined;
  }
  return parsed as { [K in keyof TShape]: z.output<TShape[K]> };
}

/**
 * Turns a params object back into URL search params. Empty and default-equal values
 * are left out, so a clean list has a clean URL. Arrays repeat the key.
 */
export function serializeListParams(
  params: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (value === defaults[key]) continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
      continue;
    }
    search.set(key, String(value));
  }
  return search;
}
