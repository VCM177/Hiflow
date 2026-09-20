/**
 * Reads WEB_ORIGIN: a comma-separated list of exact origins. A wildcard, a path
 * or a trailing slash is a mistake worth failing the boot for, because it would
 * silently open the API to origins nobody meant to allow.
 */
export function parseAllowedOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    if (origin === '*') {
      throw new Error('WEB_ORIGIN must list exact origins, never "*"');
    }

    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`WEB_ORIGIN has an entry that is not a URL: ${origin}`);
    }

    const isBareHttpOrigin =
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.origin === origin;

    if (!isBareHttpOrigin) {
      throw new Error(
        `WEB_ORIGIN entries must be bare origins such as https://app.example.com (got ${origin})`,
      );
    }
  }

  return origins;
}
