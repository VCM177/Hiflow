export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[];

/**
 * Builds `?a=1&b=x` from a params object. Empty values (null, undefined, '', []) are
 * dropped so an unset filter never reaches the API. Arrays repeat the key.
 * Returns '' when nothing is left.
 */
export function buildQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
      continue;
    }

    search.append(key, String(value));
  }

  const text = search.toString();
  return text ? `?${text}` : '';
}
