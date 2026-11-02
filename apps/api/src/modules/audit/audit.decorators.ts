import type { AuditEvent as AuditEventName } from '@hiflow/shared-types';
import { SetMetadata } from '@nestjs/common';

export const AUDIT_EVENT_KEY = 'auditEvent';
export const NO_AUDIT_KEY = 'noAudit';

export interface AuditEventMeta {
  event: AuditEventName;
  /** The route may legitimately finish without the event (a duplicate submission). */
  conditional: boolean;
}

/** Declares the event this route must record when it succeeds; the verifier checks it. */
export const AuditEvent = (
  event: AuditEventName,
  options: { conditional?: boolean } = {},
) =>
  SetMetadata(AUDIT_EVENT_KEY, {
    event,
    conditional: options.conditional ?? false,
  } satisfies AuditEventMeta);

/** A route that writes but deliberately has no event; the reason is the point. */
export const NoAudit = (reason: string) => SetMetadata(NO_AUDIT_KEY, reason);
