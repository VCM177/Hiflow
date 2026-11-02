import {
  ApplicationStatus,
  hasPermission,
  JobStatus,
  PERMISSIONS,
  UserRole,
} from '@hiflow/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'node:path';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { endOfDayExclusive, startOfDay } from '../../common/dates';
import { rethrowDbError } from '../../common/errors/db-errors';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import { departmentScope } from '../../common/scope';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { actorOf } from '../audit/audit.types';
import { TxRunner } from '../audit/tx-runner.service';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Interview } from '../interviews/entities/interview.entity';
import { Job } from '../jobs/entities/job.entity';
import { Offer } from '../offers/entities/offer.entity';
import { FileDownload, StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
import { ApplicationWorkflowService } from './application-workflow.service';
import {
  ApplicationDetail,
  ApplicationListItem,
  toHistoryItem,
  toInterviewItem,
  toListItem,
  toOfferItem,
} from './application-view';
import { ASSIGNABLE_ROLES } from './applications.constants';
import {
  ChangeStatusDto,
  CreateApplicationDto,
  ListApplicationsQueryDto,
} from './applications.dto';
import { Application } from './entities/application.entity';
import { ApplicationStatusHistory } from './entities/application-status-history.entity';

const SORT_COLUMNS: Record<ListApplicationsQueryDto['sortBy'], string> = {
  appliedAt: 'app.appliedAt',
  status: 'app.status',
  candidateName: 'candidate.fullName',
  jobTitle: 'job.title',
};

/** The CV sent with the application, else the one on the candidate profile. */
const cvKeyOf = (application: Application): string | null =>
  application.cvFileKey ?? application.candidate?.cvFileKey ?? null;

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    @InjectRepository(ApplicationStatusHistory)
    private readonly history: Repository<ApplicationStatusHistory>,
    @InjectRepository(Candidate)
    private readonly candidates: Repository<Candidate>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    private readonly workflow: ApplicationWorkflowService,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly tx: TxRunner,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListApplicationsQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<ApplicationListItem>> {
    const qb = this.scopedQuery(actor);

    if (query.search) {
      qb.andWhere(
        '(candidate.fullName ILIKE :q OR candidate.email ILIKE :q OR job.title ILIKE :q)',
        { q: containsPattern(query.search) },
      );
    }
    if (query.status) {
      qb.andWhere('app.status = :status', { status: query.status });
    }
    if (query.jobId) {
      qb.andWhere('app.jobId = :jobId', { jobId: query.jobId });
    }
    if (query.candidateId) {
      qb.andWhere('app.candidateId = :candidateId', {
        candidateId: query.candidateId,
      });
    }
    if (query.assigneeId) {
      qb.andWhere('app.assigneeId = :assigneeId', {
        assigneeId: query.assigneeId,
      });
    }
    if (query.departmentId) {
      qb.andWhere('job.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.appliedFrom) {
      qb.andWhere('app.appliedAt >= :from', {
        from: startOfDay(query.appliedFrom),
      });
    }
    if (query.appliedTo) {
      qb.andWhere('app.appliedAt < :to', {
        to: endOfDayExclusive(query.appliedTo),
      });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('app.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toListItem), meta: page.meta };
  }

  async get(id: string, actor: AuthUser): Promise<ApplicationDetail> {
    const application = await this.findScoped(id, actor);

    const [history, interviews, offer] = await Promise.all([
      this.history.find({
        where: { applicationId: id },
        relations: { changedBy: true },
        order: { changedAt: 'ASC' },
      }),
      this.interviews.find({
        where: { applicationId: id },
        relations: { interviewer: true },
        order: { round: 'ASC', scheduledAt: 'ASC' },
      }),
      hasPermission(actor.permissions, PERMISSIONS.offer.view)
        ? this.offers.findOneBy({ applicationId: id })
        : Promise.resolve(null),
    ]);

    return {
      ...toListItem(application),
      note: application.note,
      hasCv: cvKeyOf(application) !== null,
      candidateDetail: application.candidate
        ? {
            phone: application.candidate.phone,
            hasCv: application.candidate.cvFileKey !== null,
          }
        : null,
      history: history.map(toHistoryItem),
      interviews: interviews.map(toInterviewItem),
      offer: offer ? toOfferItem(offer) : null,
    };
  }

  async create(
    dto: CreateApplicationDto,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    const candidate = await this.candidates.findOneBy({ id: dto.candidateId });
    if (!candidate) {
      throw new BadRequestException('Ứng viên không tồn tại');
    }
    if (candidate.anonymizedAt) {
      throw new ConflictException(
        'Ứng viên đã được ẩn danh nên không thể tạo hồ sơ mới',
      );
    }

    const job = await this.jobs.findOneBy({ id: dto.jobId });
    if (!job) {
      throw new BadRequestException('Tin tuyển dụng không tồn tại');
    }
    if (job.status !== JobStatus.OPEN) {
      throw new ConflictException(
        'Chỉ nộp hồ sơ vào tin đang tuyển (chưa đăng hoặc đã đóng)',
      );
    }

    const assigneeId =
      dto.assigneeId ??
      (actor.role === UserRole.RECRUITER ? actor.id : undefined);
    if (assigneeId) await this.assertAssignable(assigneeId);

    try {
      const id = await this.tx.run(actorOf(actor), async (manager, audit) => {
        const created = await this.workflow.createNew(manager, {
          candidateId: dto.candidateId,
          jobId: dto.jobId,
          assigneeId,
          note: dto.note,
          createdById: actor.id,
          historyNote: 'Tạo hồ sơ',
        });
        if (created) await audit.record('APPLICATION_CREATED', created);
        return created;
      });

      if (!id) {
        throw new ConflictException('Ứng viên đã nộp hồ sơ vào tin này');
      }

      return await this.get(id, actor);
    } catch (error) {
      return rethrowDbError(error, {
        unique: 'Ứng viên đã nộp hồ sơ vào tin này',
      });
    }
  }

  /** Authorised by the same scope rule as reading the application. */
  async downloadCv(id: string, actor: AuthUser): Promise<FileDownload> {
    const application = await this.findScoped(id, actor);
    const key = cvKeyOf(application);

    if (!key) {
      throw new NotFoundException('Hồ sơ này không có CV đính kèm');
    }

    // Reading a CV is reading personal data, so the trail says who did.
    await this.audit.recordStandalone(
      actorOf(actor),
      'APPLICATION_CV_DOWNLOADED',
      id,
    );
    return this.storage.download(key, `CV-${id}${extname(key)}`);
  }

  async assign(
    id: string,
    assigneeId: string | null,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    const application = await this.findScoped(id, actor);
    if (assigneeId) await this.assertAssignable(assigneeId);

    if (application.assigneeId !== assigneeId) {
      const from = application.assigneeId;
      await this.tx.run(actorOf(actor), async (manager, audit) => {
        await manager.getRepository(Application).update(id, { assigneeId });
        await audit.record('APPLICATION_ASSIGNEE_CHANGED', id, {
          from,
          to: assigneeId,
        });
      });
    }
    return this.get(id, actor);
  }

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    const application = await this.findScoped(id, actor);

    await this.tx.run(actorOf(actor), (manager, audit) =>
      this.workflow.moveTo(
        manager,
        application,
        dto.toStatus,
        actor.id,
        dto.note ?? null,
        audit,
      ),
    );

    return this.get(id, actor);
  }

  async setNote(
    id: string,
    note: string,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    const application = await this.findScoped(id, actor);
    const next = note === '' ? null : note;

    if (application.note !== next) {
      await this.tx.run(actorOf(actor), async (manager, audit) => {
        await manager.getRepository(Application).update(id, { note: next });
        await audit.record('APPLICATION_NOTE_UPDATED', id);
      });
    }
    return this.get(id, actor);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const application = await this.findScoped(id, actor);

    if (application.status !== ApplicationStatus.NEW) {
      throw new ConflictException('Chỉ xóa được hồ sơ ở trạng thái Mới');
    }

    await this.tx.run(actorOf(actor), async (manager, audit) => {
      const result = await manager.getRepository(Application).delete({
        id,
        status: ApplicationStatus.NEW,
      });
      if (!result.affected) {
        throw new ConflictException(
          'Hồ sơ vừa được xử lý bởi người khác, vui lòng tải lại',
        );
      }
      await audit.record('APPLICATION_DELETED', id);
    });

    if (application.cvFileKey) {
      // Best effort: a leftover file is a nuisance, never a reason to fail.
      await this.storage
        .remove(application.cvFileKey)
        .catch((error: unknown) => {
          this.logger.warn(
            `Could not delete ${application.cvFileKey}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }
  }

  /**
   * Department managers see their own department's jobs; interviewers see only
   * applications they are scheduled to interview.
   */
  private scopedQuery(actor: AuthUser): SelectQueryBuilder<Application> {
    const qb = this.applications
      .createQueryBuilder('app')
      .innerJoinAndSelect('app.candidate', 'candidate')
      .innerJoinAndSelect('app.job', 'job')
      .leftJoinAndSelect('app.assignee', 'assignee');

    const scope = departmentScope(actor);
    if (scope) {
      qb.andWhere('job.departmentId = :scope', { scope });
    }

    if (actor.role === UserRole.INTERVIEWER) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM interviews i
           WHERE i.application_id = app.id AND i.interviewer_id = :me
         )`,
        { me: actor.id },
      );
    }

    return qb;
  }

  private async findScoped(id: string, actor: AuthUser): Promise<Application> {
    const application = await this.scopedQuery(actor)
      .andWhere('app.id = :id', { id })
      .getOne();

    if (!application) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng tuyển');
    }

    return application;
  }

  private async assertAssignable(userId: string): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });

    if (!user || !user.isActive) {
      throw new BadRequestException(
        'Người phụ trách không tồn tại hoặc đã bị khóa',
      );
    }
    if (!ASSIGNABLE_ROLES.includes(user.role)) {
      throw new BadRequestException(
        'Người phụ trách phải là nhân viên tuyển dụng, quản lý nhân sự hoặc quản trị viên',
      );
    }
  }
}
