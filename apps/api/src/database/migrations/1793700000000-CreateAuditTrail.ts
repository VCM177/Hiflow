import { MigrationInterface, QueryRunner } from 'typeorm';

const AUDITED_TABLES = [
  'users',
  'departments',
  'job_positions',
  'requisitions',
  'jobs',
  'candidates',
  'applications',
  'application_status_histories',
  'interviews',
  'offers',
] as const;

const appRole = (): string => {
  const role = process.env.DB_APP_ROLE ?? 'hiflow_app';

  if (!/^[a-z_][a-z0-9_]*$/.test(role)) {
    throw new Error(`DB_APP_ROLE "${role}" is not a plain role name`);
  }

  return role;
};

/**
 * Both capture functions read the transaction context the application sets with
 * `set_config('hiflow.*', ..., true)`. This first version records writes made
 * without that context as `maintenance` instead of refusing them; a later
 * migration turns the refusal on once every service goes through the runner.
 */
const CAPTURE_FUNCTION = `
CREATE FUNCTION hiflow_audit_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  v_tx text := nullif(current_setting('hiflow.tx_id', true), '');
  v_actor text := nullif(current_setting('hiflow.actor_id', true), '');
  v_request text := nullif(current_setting('hiflow.request_id', true), '');
  v_origin text := nullif(current_setting('hiflow.origin', true), '');
  v_is_owner boolean := has_table_privilege(current_user, 'audit_row_changes', 'DELETE');
  v_old jsonb;
  v_new jsonb;
  v_row text;
  v_changes jsonb;
BEGIN
  -- Only the owner may switch capture off (clean-up of test and demo data).
  IF v_is_owner AND current_setting('hiflow.capture', true) = 'off' THEN
    RETURN NULL;
  END IF;

  -- No context: a session may still tag itself (the tests do); otherwise it is maintenance.
  IF v_tx IS NULL THEN
    v_tx := md5('tx-' || txid_current()::text);
    v_origin := coalesce(v_origin, 'maintenance');
  END IF;

  v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_row := coalesce(v_new, v_old) ->> 'id';

  IF TG_OP = 'INSERT' THEN
    v_changes := v_new - 'created_at' - 'updated_at';
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := v_old - 'created_at' - 'updated_at';
  ELSE
    SELECT jsonb_object_agg(n.key, jsonb_build_array(o.value, n.value))
      INTO v_changes
      FROM jsonb_each(v_new) n
      LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
     WHERE n.value IS DISTINCT FROM o.value
       AND n.key NOT IN ('created_at', 'updated_at');

    -- Nothing but the bookkeeping columns changed.
    IF v_changes IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  -- The hash itself is a secret; the fact that it changed is not.
  IF TG_TABLE_NAME = 'users' AND v_changes ? 'password_hash' THEN
    v_changes := jsonb_set(
      v_changes,
      '{password_hash}',
      CASE WHEN TG_OP = 'UPDATE'
        THEN '["[REDACTED]", "[REDACTED]"]'::jsonb
        ELSE '"[REDACTED]"'::jsonb END
    );
  END IF;

  INSERT INTO audit_row_changes
    (tx_id, table_name, row_id, op, changes, actor_id, request_id, origin)
  VALUES
    (v_tx::uuid, TG_TABLE_NAME, v_row::uuid, left(TG_OP, 1), v_changes,
     v_actor::uuid, v_request::uuid, coalesce(v_origin, 'app'));

  RETURN NULL;
END
$fn$`;

/**
 * The audit tables are append-only. The one thing that may be rewritten, and
 * only by the owner while purging, is blanking an old row's IP and user agent.
 */
const IMMUTABLE_FUNCTION = `
CREATE FUNCTION hiflow_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  -- An unset setting is NULL, and NOT NULL would not stop anything.
  v_purging boolean := coalesce(current_setting('hiflow.purge', true) = 'on', false);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF v_purging
       AND (to_jsonb(NEW) - 'ip' - 'user_agent') = (to_jsonb(OLD) - 'ip' - 'user_agent')
       AND to_jsonb(NEW) -> 'ip' IS NOT DISTINCT FROM 'null'::jsonb
       AND to_jsonb(NEW) -> 'user_agent' IS NOT DISTINCT FROM 'null'::jsonb THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'audit tables are append-only' USING ERRCODE = 'HF002';
  END IF;

  IF NOT v_purging THEN
    RAISE EXCEPTION 'audit rows can only be deleted while purging' USING ERRCODE = 'HF003';
  END IF;

  IF TG_LEVEL = 'ROW' THEN
    RETURN OLD;
  END IF;
  RETURN NULL;
END
$fn$`;

export class CreateAuditTrail1793700000000 implements MigrationInterface {
  name = 'CreateAuditTrail1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const role = appRole();
    const found = (await queryRunner.query(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      [role],
    )) as unknown[];

    if (found.length === 0) {
      throw new Error(
        `Database role "${role}" does not exist. Create it first ` +
          `(docs/audit-trail-spec.md, section 3), or set DB_APP_ROLE.`,
      );
    }

    await queryRunner.query(
      `CREATE TABLE "audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), "event" character varying(64) NOT NULL, "entity_type" character varying(32) NOT NULL, "entity_id" uuid, "actor_id" uuid, "actor_name" character varying, "actor_role" character varying(32), "tx_id" uuid NOT NULL, "request_id" uuid, "origin" character varying(16) NOT NULL, "ip" inet, "user_agent" character varying(256), "data" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_audit_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_occurred" ON "audit_events" ("occurred_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_entity" ON "audit_events" ("entity_type", "entity_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_actor" ON "audit_events" ("actor_id", "occurred_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_tx" ON "audit_events" ("tx_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_events_event" ON "audit_events" ("event", "occurred_at") `,
    );

    await queryRunner.query(
      `CREATE TABLE "audit_row_changes" ("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL, "tx_id" uuid NOT NULL, "table_name" character varying(64) NOT NULL, "row_id" uuid NOT NULL, "op" character(1) NOT NULL, "changes" jsonb NOT NULL, "actor_id" uuid, "request_id" uuid, "origin" character varying(16) NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp(), CONSTRAINT "PK_audit_row_changes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_row_changes_row" ON "audit_row_changes" ("table_name", "row_id", "id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_row_changes_tx" ON "audit_row_changes" ("tx_id") `,
    );

    await queryRunner.query(CAPTURE_FUNCTION);
    await queryRunner.query(IMMUTABLE_FUNCTION);

    for (const table of AUDITED_TABLES) {
      await queryRunner.query(
        `CREATE TRIGGER hiflow_audit AFTER INSERT OR UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION hiflow_audit_capture()`,
      );
    }
    for (const table of ['audit_events', 'audit_row_changes']) {
      await queryRunner.query(
        `CREATE TRIGGER hiflow_audit_immutable BEFORE UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION hiflow_audit_immutable()`,
      );
      await queryRunner.query(
        `CREATE TRIGGER hiflow_audit_no_truncate BEFORE TRUNCATE ON "${table}" FOR EACH STATEMENT EXECUTE FUNCTION hiflow_audit_immutable()`,
      );
    }

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
    );
    await queryRunner.query(
      `REVOKE UPDATE, DELETE ON "audit_events", "audit_row_changes" FROM "${role}"`,
    );
    await queryRunner.query(
      `REVOKE INSERT, UPDATE, DELETE ON "migrations" FROM "${role}"`,
    );
    await queryRunner.query(
      `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${role}"`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${role}"`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${role}"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const role = appRole();

    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT, UPDATE ON SEQUENCES FROM "${role}"`,
    );
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM "${role}"`,
    );

    for (const table of AUDITED_TABLES) {
      await queryRunner.query(`DROP TRIGGER hiflow_audit ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE "audit_row_changes"`);
    await queryRunner.query(`DROP TABLE "audit_events"`);
    await queryRunner.query(`DROP FUNCTION hiflow_audit_immutable()`);
    await queryRunner.query(`DROP FUNCTION hiflow_audit_capture()`);

    await queryRunner.query(
      `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM "${role}"`,
    );
    await queryRunner.query(
      `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${role}"`,
    );
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM "${role}"`);
  }
}
