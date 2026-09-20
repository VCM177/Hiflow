import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1789917123561 implements MigrationInterface {
  name = 'InitSchema1789917123561';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "code" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8681da666ad9699d568b3e91064" UNIQUE ("name"), CONSTRAINT "UQ_91fddbe23e927e1e525c152baa3" UNIQUE ("code"), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'HR_MANAGER', 'DEPT_MANAGER', 'RECRUITER', 'INTERVIEWER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "full_name" character varying NOT NULL, "role" "public"."user_role" NOT NULL, "department_id" uuid, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "job_positions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "code" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_5946e043e0511ee36b22d624ecd" UNIQUE ("name"), CONSTRAINT "UQ_63cb5feb8df11985f3a9adafc6f" UNIQUE ("code"), CONSTRAINT "PK_647b08f0ec097a17f8fff8adfb9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."requisition_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "requisitions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "title" character varying NOT NULL, "department_id" uuid NOT NULL, "position_id" uuid NOT NULL, "quantity" integer NOT NULL, "reason" text, "expected_start_date" date, "budget_min" numeric(15,0), "budget_max" numeric(15,0), "status" "public"."requisition_status" NOT NULL DEFAULT 'DRAFT', "created_by_id" uuid NOT NULL, "approved_by_id" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "reject_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_1529ce06bfd798d133b2a6e75b6" UNIQUE ("code"), CONSTRAINT "PK_be24649237292ddbd473f3ded92" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."job_status" AS ENUM('DRAFT', 'OPEN', 'CLOSED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "requisition_id" uuid NOT NULL, "title" character varying NOT NULL, "position_id" uuid NOT NULL, "department_id" uuid NOT NULL, "quantity" integer NOT NULL, "salary_min" numeric(15,0), "salary_max" numeric(15,0), "location" character varying, "description" text, "status" "public"."job_status" NOT NULL DEFAULT 'DRAFT', "published_at" TIMESTAMP WITH TIME ZONE, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."candidate_source" AS ENUM('WEBSITE', 'REFERRAL', 'SOCIAL', 'AGENCY', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "candidates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying, "dob" date, "source" "public"."candidate_source" NOT NULL DEFAULT 'OTHER', "cv_file_url" character varying, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c0de76a18c2a505ceb016746822" UNIQUE ("email"), CONSTRAINT "PK_140681296bf033ab1eb95288abb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."application_status" AS ENUM('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "candidate_id" uuid NOT NULL, "job_id" uuid NOT NULL, "status" "public"."application_status" NOT NULL DEFAULT 'NEW', "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "assignee_id" uuid, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d1a0f9040afc46f7672793a391a" UNIQUE ("candidate_id", "job_id"), CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."interview_result" AS ENUM('PENDING', 'PASSED', 'FAILED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "interviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "round" integer NOT NULL DEFAULT '1', "scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL, "interviewer_id" uuid NOT NULL, "result" "public"."interview_result" NOT NULL DEFAULT 'PENDING', "feedback" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fd41af1f96d698fa33c2f070f47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."offer_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "offers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "salary" numeric(15,0) NOT NULL, "start_date" date NOT NULL, "expires_at" date, "status" "public"."offer_status" NOT NULL DEFAULT 'PENDING', "note" text, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_9776f4b29f47b095c0c97aab366" UNIQUE ("application_id"), CONSTRAINT "REL_9776f4b29f47b095c0c97aab36" UNIQUE ("application_id"), CONSTRAINT "PK_4c88e956195bba85977da21b8f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "application_status_histories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "application_id" uuid NOT NULL, "from_status" "public"."application_status", "to_status" "public"."application_status" NOT NULL, "note" text, "changed_by_id" uuid NOT NULL, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d8d40f190bd5db5ad837384de59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6b1ba180f1e04e9bfbc64d55b2" ON "application_status_histories" ("application_id", "changed_at") `,
    );
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
      `ALTER TABLE "users" ADD CONSTRAINT "FK_0921d1972cf861d568f5271cd85" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" ADD CONSTRAINT "FK_966fb1dba0e2595fbd2f327327f" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" ADD CONSTRAINT "FK_69191d5b1976cfee283e10c9005" FOREIGN KEY ("position_id") REFERENCES "job_positions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" ADD CONSTRAINT "FK_320bc7227c429fdbe4d89f01a9e" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" ADD CONSTRAINT "FK_7cd4697354818ff728006e00709" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_0641f274cb3d48c48afe0d50540" FOREIGN KEY ("requisition_id") REFERENCES "requisitions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_8503910876e4b312abd47172676" FOREIGN KEY ("position_id") REFERENCES "job_positions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_fa8f106c019cb050738fd165271" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD CONSTRAINT "FK_21469bb2d10f6a142694810c220" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_b669b991b85b808f24b5734990a" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_8aba14d7f098c23ba06d8693235" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" ADD CONSTRAINT "FK_e6724970100fd671d79ad71e444" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interviews" ADD CONSTRAINT "FK_77f7078daea9f2b36e9ff761bd1" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "interviews" ADD CONSTRAINT "FK_dab087b7d082364ae58637eafbb" FOREIGN KEY ("interviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_9776f4b29f47b095c0c97aab366" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD CONSTRAINT "FK_a753b826ce98e3d46c18d0af57d" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" ADD CONSTRAINT "FK_3b47788338e9ad5f42f4f072db1" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" ADD CONSTRAINT "FK_deded8adda0dbaccacd5c01a873" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_d4a993f3a163eca3d27ffee1361" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_d4a993f3a163eca3d27ffee1361"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" DROP CONSTRAINT "FK_deded8adda0dbaccacd5c01a873"`,
    );
    await queryRunner.query(
      `ALTER TABLE "application_status_histories" DROP CONSTRAINT "FK_3b47788338e9ad5f42f4f072db1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT "FK_a753b826ce98e3d46c18d0af57d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" DROP CONSTRAINT "FK_9776f4b29f47b095c0c97aab366"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interviews" DROP CONSTRAINT "FK_dab087b7d082364ae58637eafbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interviews" DROP CONSTRAINT "FK_77f7078daea9f2b36e9ff761bd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_e6724970100fd671d79ad71e444"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_8aba14d7f098c23ba06d8693235"`,
    );
    await queryRunner.query(
      `ALTER TABLE "applications" DROP CONSTRAINT "FK_b669b991b85b808f24b5734990a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_21469bb2d10f6a142694810c220"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_fa8f106c019cb050738fd165271"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_8503910876e4b312abd47172676"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "FK_0641f274cb3d48c48afe0d50540"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" DROP CONSTRAINT "FK_7cd4697354818ff728006e00709"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" DROP CONSTRAINT "FK_320bc7227c429fdbe4d89f01a9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" DROP CONSTRAINT "FK_69191d5b1976cfee283e10c9005"`,
    );
    await queryRunner.query(
      `ALTER TABLE "requisitions" DROP CONSTRAINT "FK_966fb1dba0e2595fbd2f327327f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_0921d1972cf861d568f5271cd85"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_153c3fec7301b8bcc96a0e1537"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1fa31efc2a0bc0b517b9f7225d"`,
    );
    await queryRunner.query(`DROP TABLE "activity_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6b1ba180f1e04e9bfbc64d55b2"`,
    );
    await queryRunner.query(`DROP TABLE "application_status_histories"`);
    await queryRunner.query(`DROP TABLE "offers"`);
    await queryRunner.query(`DROP TYPE "public"."offer_status"`);
    await queryRunner.query(`DROP TABLE "interviews"`);
    await queryRunner.query(`DROP TYPE "public"."interview_result"`);
    await queryRunner.query(`DROP TABLE "applications"`);
    await queryRunner.query(`DROP TYPE "public"."application_status"`);
    await queryRunner.query(`DROP TABLE "candidates"`);
    await queryRunner.query(`DROP TYPE "public"."candidate_source"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TYPE "public"."job_status"`);
    await queryRunner.query(`DROP TABLE "requisitions"`);
    await queryRunner.query(`DROP TYPE "public"."requisition_status"`);
    await queryRunner.query(`DROP TABLE "job_positions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
