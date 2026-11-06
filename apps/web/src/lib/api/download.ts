import { API_BASE } from './client';
import { ApiError, messagesFromBody, parseRetryAfter } from './errors';
import { buildQueryString, type QueryValue } from './query-string';

/** The file name the server suggests in `Content-Disposition`, or `fallback`. */
export function filenameFrom(header: string | null, fallback: string): string {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header ?? '');
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Downloads a file the API builds on request (a CSV export) and hands it to the browser as a
 * normal download. Errors come back as `ApiError`, like every other call. Resolves with the
 * file name that was used.
 */
export async function downloadFile(
  path: string,
  query: Record<string, QueryValue> = {},
  fallbackName = 'download.csv',
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQueryString(query)}`, {
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, []);
  }
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(
      response.status,
      messagesFromBody(body),
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }

  const name = filenameFrom(
    response.headers.get('Content-Disposition'),
    fallbackName,
  );
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return name;
}
