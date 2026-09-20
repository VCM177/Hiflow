import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Requisition codes come from a Postgres sequence rather than "count + 1", which
 * would hand two concurrent requests the same number.
 */
export class AddRequisitionCodeSequence1789920000000 implements MigrationInterface {
  name = 'AddRequisitionCodeSequence1789920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "requisition_code_seq" START 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "requisition_code_seq"`);
  }
}
