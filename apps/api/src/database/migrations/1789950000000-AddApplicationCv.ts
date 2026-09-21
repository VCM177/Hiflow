import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApplicationCv1789950000000 implements MigrationInterface {
  name = 'AddApplicationCv1789950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" ADD "cv_file_key" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "applications" DROP COLUMN "cv_file_key"`,
    );
  }
}
