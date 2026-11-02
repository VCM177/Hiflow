import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCandidateAnonymizedAt1793628725731 implements MigrationInterface {
  name = 'AddCandidateAnonymizedAt1793628725731';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidates" ADD "anonymized_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidates" DROP COLUMN "anonymized_at"`,
    );
  }
}
