/**
 * An error from the Hiflow API or from the network. `messages` holds the server's
 * message(s) exactly as sent (Vietnamese); `status` is 0 when no response came back.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly messages: readonly string[];
  /** Seconds to wait before retrying (from the Retry-After header on 429). */
  readonly retryAfter: number | undefined;

  constructor(
    status: number,
    messages: readonly string[],
    retryAfter?: number,
  ) {
    super(messages[0] ?? 'Có lỗi xảy ra, vui lòng thử lại.');
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.retryAfter = retryAfter;
  }
}

/**
 * Reads the API error body `{ statusCode, message }`. `message` is a string or an
 * array of strings; anything else yields no messages.
 */
export function messagesFromBody(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return [];
  }
  const { message } = body;
  if (typeof message === 'string') return [message];
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

/** Parses Retry-After in seconds (the form the API sends). Returns undefined otherwise. */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.ceil(seconds)
    : undefined;
}
