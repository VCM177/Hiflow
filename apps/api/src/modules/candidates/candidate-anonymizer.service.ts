import { APPLICATION_HOLD_STATUSES } from '@hiflow/shared-types';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuditActor } from '../audit/audit.types';
import { TxRunner } from '../audit/tx-runner.service';
import { StorageService } from '../storage/storage.service';

export const ANONYMIZED_NAME = 'Ứng viên đã ẩn danh';
const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.invalid';

/** One run never touches more than this many candidates. */
const SWEEP_BATCH = 500;

export interface SweepResult {
  found: number;
  anonymized: number;
  /** Became ineligible between the search and the erasure (a new application). */
  skipped: number;
  failed: number;
}

interface CvRow {
  cv_file_key: string | null;
}

/**
 * Erases a candidate's personal data while keeping the row, so the funnel and
 * the reports still count them. Used on request and by the retention sweep.
 */
@Injectable()
export class CandidateAnonymizerService {
  private readonly logger = new Logger(CandidateAnonymizerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly tx: TxRunner,
  ) {}

  /**
   * One transaction holds the candidate's row, so an application created at the
   * same moment waits for it instead of slipping in after the check.
   */
  async anonymize(
    id: string,
    actor: AuditActor | null,
    trigger: 'REQUEST' | 'RETENTION',
  ): Promise<void> {
    const keys = await this.tx.run(actor, async (manager, audit) => {
      const rows = await manager.query<
        (CvRow & { anonymized_at: Date | null })[]
      >(
        `SELECT cv_file_key, anonymized_at FROM candidates WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const candidate = rows[0];

      if (!candidate) {
        throw new NotFoundException('Không tìm thấy ứng viên');
      }
      if (candidate.anonymized_at) {
        throw new ConflictException('Ứng viên đã được ẩn danh');
      }

      const holding = await manager.query<{ n: number }[]>(
        `SELECT COUNT(*)::int AS n FROM applications
         WHERE candidate_id = $1 AND status::text = ANY($2)`,
        [id, APPLICATION_HOLD_STATUSES],
      );
      if ((holding[0]?.n ?? 0) > 0) {
        throw new ConflictException(
          'Ứng viên còn hồ sơ đang xử lý hoặc đã nhận việc nên chưa thể ẩn danh',
        );
      }

      const applications = await manager.query<(CvRow & { id: string })[]>(
        `SELECT id, cv_file_key FROM applications WHERE candidate_id = $1`,
        [id],
      );

      await manager.query(
        `UPDATE applications SET cv_file_key = NULL, note = NULL WHERE candidate_id = $1`,
        [id],
      );
      await manager.query(
        `UPDATE candidates
         SET full_name = $2,
             email = 'anonymized-' || id::text || '@${ANONYMIZED_EMAIL_DOMAIN}',
             phone = NULL, dob = NULL, note = NULL, cv_file_key = NULL,
             anonymized_at = now()
         WHERE id = $1`,
        [id, ANONYMIZED_NAME],
      );
      await audit.record('CANDIDATE_ANONYMIZED', id, { trigger });

      return [candidate, ...applications]
        .map((row) => row.cv_file_key)
        .filter((key): key is string => key !== null);
    });

    // Only once the data is gone: a leftover file is a nuisance, not a failure.
    await Promise.all(keys.map((key) => this.discardFile(key)));
  }

  /** Candidates nobody has touched for `months` months and who hold no live application. */
  async findExpired(months: number, limit = SWEEP_BATCH): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT c.id FROM candidates c
       WHERE c.anonymized_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM applications a
           WHERE a.candidate_id = c.id AND a.status::text = ANY($2))
         AND GREATEST(
               c.updated_at,
               COALESCE((SELECT MAX(a.applied_at) FROM applications a
                         WHERE a.candidate_id = c.id), c.updated_at),
               COALESCE((SELECT MAX(h.changed_at)
                         FROM application_status_histories h
                         JOIN applications a ON a.id = h.application_id
                         WHERE a.candidate_id = c.id), c.updated_at)
             ) < now() - make_interval(months => $1)
       ORDER BY c.updated_at ASC
       LIMIT $3`,
      [months, APPLICATION_HOLD_STATUSES, limit],
    );

    return rows.map((row) => row.id);
  }

  async sweep(months: number, dryRun = false): Promise<SweepResult> {
    const ids = await this.findExpired(months);
    const result: SweepResult = {
      found: ids.length,
      anonymized: 0,
      skipped: 0,
      failed: 0,
    };

    if (dryRun) return result;

    for (const id of ids) {
      try {
        await this.anonymize(id, null, 'RETENTION');
        result.anonymized += 1;
      } catch (error) {
        if (error instanceof ConflictException) {
          result.skipped += 1;
        } else {
          result.failed += 1;
          this.logger.error(
            `Could not anonymise ${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return result;
  }

  private async discardFile(key: string): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      this.logger.warn(
        `Could not delete ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
