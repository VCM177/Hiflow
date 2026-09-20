const SENSITIVE_KEY = /password|token|secret|authorization/i;
const MAX_DEPTH = 4;

/** Copies a request body for storage with credentials removed. */
export function sanitizePayload(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    return depth >= MAX_DEPTH
      ? '[TRUNCATED]'
      : value.map((item) => sanitizePayload(item, depth + 1));
  }

  if (value !== null && typeof value === 'object') {
    if (depth >= MAX_DEPTH) {
      return '[TRUNCATED]';
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key)
          ? '[REDACTED]'
          : sanitizePayload(item, depth + 1),
      ]),
    );
  }

  return value;
}
