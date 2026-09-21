import { CandidateSource, JobStatus } from '@hiflow/shared-types';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AttemptLimiter } from '../../common/throttle/attempt-limiter';
import { THROTTLE_POLICY } from '../../common/throttle/throttle.constants';
import { ApplicationWorkflowService } from '../applications/application-workflow.service';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Job } from '../jobs/entities/job.entity';
import {
  alreadyAppliedMail,
  applicationReceivedMail,
} from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { StorageService, UploadedFileData } from '../storage/storage.service';
import { SystemUserService } from '../users/system-user.service';
import { SubmitApplicationDto } from './submit-application.dto';
import { TurnstileService } from './turnstile.service';

/**
 * What the visitor is told, whatever happened. It is one constant on purpose:
 * a new application, a repeat of an earlier one and an email that is already on
 * file all get exactly this, so the form cannot be used to find out who has
 * applied where. The mailbox owner is told the difference by email.
 */
export const APPLICATION_RECEIPT = {
  message:
    'Chúng tôi đã nhận được hồ sơ của bạn. Vui lòng kiểm tra email để xem xác nhận.',
} as const;

@Injectable()
export class PublicApplicationsService {
  private readonly logger = new Logger(PublicApplicationsService.name);

  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly dataSource: DataSource,
    private readonly workflow: ApplicationWorkflowService,
    private readonly system: SystemUserService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly turnstile: TurnstileService,
    private readonly limiter: AttemptLimiter,
  ) {}

  async submit(
    jobId: string,
    dto: SubmitApplicationDto,
    cv: UploadedFileData | undefined,
    ip: string,
  ): Promise<typeof APPLICATION_RECEIPT> {
    // Cheapest checks first, and the captcha before anything that costs us work
    // or writes something.
    if (!cv) {
      throw new BadRequestException('Vui lòng đính kèm CV (PDF hoặc DOCX)');
    }
    await this.turnstile.verify(dto.turnstileToken, ip);
    await this.limiter.hit(THROTTLE_POLICY.PUBLIC_APPLY_EMAIL, dto.email);

    const job = await this.jobs.findOneBy({
      id: jobId,
      status: JobStatus.OPEN,
    });
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không còn nhận hồ sơ');
    }

    // The CV is validated (400 if it is not what its name says) and stored
    // before the outcome is known, so a repeat submission costs the same as a
    // first one and cannot be told apart by how long the answer takes.
    const { key } = await this.storage.upload(cv);

    let created: boolean;
    try {
      created = await this.record(job.id, dto, key);
    } catch (error) {
      await this.discard(key);
      throw error;
    }
    if (!created) await this.discard(key);

    // Not awaited: a slow mail provider must not slow the answer, and mail
    // never fails a request (the service logs its own errors).
    const template = created ? applicationReceivedMail : alreadyAppliedMail;
    void this.mail.send(
      template({ to: dto.email, fullName: dto.fullName, jobTitle: job.title }),
    );

    return APPLICATION_RECEIPT;
  }

  /**
   * Finds or creates the candidate and adds the application, in one transaction.
   * An existing candidate is left exactly as it was: the form has no way to
   * prove the email belongs to the sender, so it must never overwrite anything.
   * Returns false when this candidate had already applied to this job.
   */
  private record(
    jobId: string,
    dto: SubmitApplicationDto,
    cvFileKey: string,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      // ON CONFLICT DO NOTHING keeps two simultaneous first submissions from the
      // same address from failing each other with a unique violation.
      await manager
        .createQueryBuilder()
        .insert()
        .into(Candidate)
        .values({
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          source: CandidateSource.WEBSITE,
        })
        .orIgnore()
        .execute();

      const candidate = await manager.findOneByOrFail(Candidate, {
        email: dto.email,
      });

      const id = await this.workflow.createNew(manager, {
        candidateId: candidate.id,
        jobId,
        cvFileKey,
        consentAt: new Date(),
        createdById: await this.system.id(),
        historyNote: 'Ứng viên nộp hồ sơ qua website',
      });

      return id !== null;
    });
  }

  /** Best effort: a leftover file is a nuisance, never a reason to fail. */
  private async discard(key: string): Promise<void> {
    try {
      await this.storage.remove(key);
    } catch (error) {
      this.logger.warn(
        `Could not delete ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
