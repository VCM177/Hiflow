import type { AuditEvent } from '@hiflow/shared-types';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';

const MAX_USER_AGENT = 256;

export interface RequestContextData {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  /** Audit events written during this request, for the verifier. */
  recorded: Set<AuditEvent>;
}

const storage = new AsyncLocalStorage<RequestContextData>();

/** What the current request is, for whoever needs it without being handed it. */
export const requestContext = {
  get: (): RequestContextData | undefined => storage.getStore(),
  run: <T>(data: RequestContextData, work: () => T): T =>
    storage.run(data, work),
};

/** An address Postgres' `inet` accepts: no zone suffix, nothing that is not an IP. */
export const cleanIp = (value: string | undefined): string | null => {
  const ip = value?.split('%')[0];
  return ip && isIP(ip) !== 0 ? ip : null;
};

export const cleanUserAgent = (value: string | undefined): string | null =>
  value ? value.slice(0, MAX_USER_AGENT) : null;

/**
 * Starts the context of a request. `req.ip` already went through TRUST_PROXY, so
 * behind the web app's proxy it is the visitor's address, not the proxy's.
 */
export function requestContextMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  requestContext.run(
    {
      requestId: randomUUID(),
      ip: cleanIp(request.ip),
      userAgent: cleanUserAgent(request.headers['user-agent']),
      recorded: new Set(),
    },
    next,
  );
}
