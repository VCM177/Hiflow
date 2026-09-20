import { ActivityLog } from './entities/activity-log.entity';

export interface ActivityLogView {
  id: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  route: string | null;
  /** The request body as stored: credentials were removed before saving. */
  body: Record<string, unknown> | null;
  createdAt: string;
}

export const toActivityLogView = (log: ActivityLog): ActivityLogView => {
  const payload = log.payload as {
    route?: string;
    body?: Record<string, unknown>;
  } | null;

  return {
    id: log.id,
    actor: log.actor
      ? {
          id: log.actor.id,
          name: log.actor.fullName,
          email: log.actor.email,
        }
      : null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    route: payload?.route ?? null,
    body: payload?.body ?? null,
    createdAt: log.createdAt.toISOString(),
  };
};

/** One flat row per entry, for the CSV export. */
export interface ActivityLogCsvRow {
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  route: string;
}

export const toCsvRow = (view: ActivityLogView): ActivityLogCsvRow => ({
  createdAt: view.createdAt,
  actor: view.actor?.name ?? '',
  action: view.action,
  entityType: view.entityType,
  entityId: view.entityId ?? '',
  route: view.route ?? '',
});
