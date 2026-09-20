import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CV files stop being public URLs. The column now holds the storage key
 * ("cv/<uuid>.pdf"), and the file is only reachable through an authenticated
 * download. Existing values lose their "/uploads/" prefix.
 */
export class StoreCvAsPrivateKey1789930000000 implements MigrationInterface {
  name = 'StoreCvAsPrivateKey1789930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "candidates" RENAME COLUMN "cv_file_url" TO "cv_file_key"`,
    );
    await queryRunner.query(
      `UPDATE "candidates" SET "cv_file_key" = substr("cv_file_key", length('/uploads/') + 1) WHERE "cv_file_key" LIKE '/uploads/%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "candidates" SET "cv_file_key" = '/uploads/' || "cv_file_key" WHERE "cv_file_key" IS NOT NULL AND "cv_file_key" NOT LIKE '/uploads/%'`,
    );
    await queryRunner.query(
      `ALTER TABLE "candidates" RENAME COLUMN "cv_file_key" TO "cv_file_url"`,
    );
  }
}
