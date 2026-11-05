/** Where an unauthenticated visitor is sent, remembering the page they asked for. */
export function loginUrlFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}

/**
 * Reads the `next` query value of the login page. Only an in-app path is accepted:
 * anything else (another site, a protocol-relative URL, a backslash trick) yields
 * undefined so the login page cannot be used as an open redirect.
 */
export function safeNextPath(
  value: string | null | undefined,
): string | undefined {
  if (!value || !value.startsWith('/')) return undefined;
  if (value.startsWith('//') || value.includes('\\')) return undefined;
  if (/[\u0000-\u001f]/.test(value)) return undefined;
  return value;
}
