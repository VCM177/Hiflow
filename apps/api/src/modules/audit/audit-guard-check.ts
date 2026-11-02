import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

const AUDIT_TABLES = ['audit_events', 'audit_row_changes'] as const;
const FORBIDDEN = ['UPDATE', 'DELETE', 'TRUNCATE'] as const;

/**
 * The trail is only trustworthy if the role the API runs as cannot rewrite it,
 * so the API refuses to start as a role that could.
 */
@Injectable()
export class AuditGuardCheck implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const checks = AUDIT_TABLES.flatMap((table) =>
      FORBIDDEN.map(
        (privilege) =>
          `(has_table_privilege(current_user, '${table}', '${privilege}'))::text`,
      ),
    );
    const rows = await this.dataSource.query<
      { role: string; allowed: string[] }[]
    >(`SELECT current_user AS role, ARRAY[${checks.join(', ')}] AS allowed`);

    const { role, allowed } = rows[0];
    if (allowed.includes('true')) {
      throw new Error(
        `The database role "${role}" can change the audit tables. Run the API as ` +
          `the restricted role (DATABASE_URL) and keep the owner role for ` +
          `migrations (DATABASE_OWNER_URL); see docs/audit-trail-spec.md, section 3.`,
      );
    }
  }
}
