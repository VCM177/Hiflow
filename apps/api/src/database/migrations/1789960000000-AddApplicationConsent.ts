import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationConsent1789960000000 implements MigrationInterface {
  name = 'AddApplicationConsent1789960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" ADD "consent_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" DROP COLUMN "consent_at"`,
    );
  }
}
