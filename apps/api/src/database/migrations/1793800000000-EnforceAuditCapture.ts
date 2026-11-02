import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The capture function, with or without the refusal. `enforce` is what the
 * first audit migration left off: until every service went through `TxRunner`
 * a write without a transaction context was recorded as maintenance.
 */
const captureFunction = (
  enforce: boolean,
): string => `CREATE OR REPLACE FUNCTION hiflow_audit_capture() RETURNS trigger LANGUAGE plpgsql AS $fn$
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

${enforce ? ENFORCING : RELAXED}
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

const RELAXED = `  -- No context: a session may still tag itself (the tests do); otherwise it is maintenance.
  IF v_tx IS NULL THEN
    v_tx := md5('tx-' || txid_current()::text);
    v_origin := coalesce(v_origin, 'maintenance');
  END IF;
`;
const ENFORCING = `  -- No context: the API role may not write at all (it must go through TxRunner); the
  -- owner may, as maintenance, and a session may still tag itself (the tests do).
  IF v_tx IS NULL THEN
    IF NOT v_is_owner THEN
      RAISE EXCEPTION 'write to % outside a TxRunner transaction', TG_TABLE_NAME
        USING ERRCODE = 'HF001';
    END IF;
    v_tx := md5('tx-' || txid_current()::text);
    v_origin := coalesce(v_origin, 'maintenance');
  END IF;
`;

export class EnforceAuditCapture1793800000000 implements MigrationInterface {
  name = 'EnforceAuditCapture1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The row-level trail and the events replace it; it only held demo and test data.
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(captureFunction(true));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(captureFunction(false));

    await queryRunner.query(
      `CREATE TABLE "activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_id" uuid, "action" character varying NOT NULL, "entity_type" character varying NOT NULL, "entity_id" character varying, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1fa31efc2a0bc0b517b9f7225d" ON "activity_logs" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_153c3fec7301b8bcc96a0e1537" ON "activity_logs" ("entity_type", "entity_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_d4a993f3a163eca3d27ffee1361" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
