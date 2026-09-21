import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export const SYSTEM_USER_EMAIL = 'system@hiflow.local';
export const SYSTEM_USER_NAME = 'Ứng viên (Website)';

/**
 * Adds the built-in system account that authors history rows for applications
 * submitted through the public website (there is no signed-in person to
 * credit). It is created by the migration, not a seed, so a production database
 * has it without anyone running a seed script.
 *
 * Least privilege: the role is INTERVIEWER, the account is locked, and its
 * password is a random value that is hashed and then forgotten.
 */
export class AddSystemUser1789940000000 implements MigrationInterface {
  name = 'AddSystemUser1789940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "is_system" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_single_system" ON "users" ("is_system") WHERE "is_system"`,
    );

    const passwordHash: string = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      10,
    );
    await queryRunner.query(
      `INSERT INTO "users" ("email", "password_hash", "full_name", "role", "is_active", "is_system")
       VALUES ($1, $2, $3, 'INTERVIEWER', false, true)`,
      [SYSTEM_USER_EMAIL, passwordHash, SYSTEM_USER_NAME],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT COUNT(*) AS count FROM "application_status_histories"
       WHERE "changed_by_id" IN (SELECT "id" FROM "users" WHERE "is_system")`,
    )) as { count: string }[];

    // History is an audit trail: never delete it to make a rollback succeed.
    if (Number(rows[0].count) > 0) {
      throw new Error(
        `Cannot remove the system user: ${rows[0].count} history rows were authored by it`,
      );
    }

    await queryRunner.query(`DELETE FROM "users" WHERE "is_system"`);
    await queryRunner.query(`DROP INDEX "UQ_users_single_system"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_system"`);
  }
}
