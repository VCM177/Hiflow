/**
 * The public address of the web app (`SITE_URL`, no trailing slash), for absolute links in
 * search results: the sitemap, canonical addresses and the job data search engines read.
 * Outside production it falls back to the dev server; in production it must be set, or links
 * stay relative.
 */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const configured = env.SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  return env.NODE_ENV === 'production' ? null : 'http://localhost:3000';
}

/** `path` made absolute with the site address, or left as it is when there is no address. */
export function absoluteUrl(
  path: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const base = siteUrl(env);
  return base ? `${base}${path}` : path;
}
