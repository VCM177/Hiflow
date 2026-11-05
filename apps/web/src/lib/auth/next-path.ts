/** Where an unauthenticated visitor is sent, remembering the page they asked for. */
export function loginUrlFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
