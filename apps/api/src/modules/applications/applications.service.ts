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
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
import { Candidate } from '../candidates/entities/candidate.entity';
import { Interview } from '../interviews/entities/interview.entity';
import { Job } from '../jobs/entities/job.entity';
import { Offer } from '../offers/entities/offer.entity';
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

@Injectable()
export class ApplicationsService {
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
      candidateDetail: application.candidate
        ? {
            phone: application.candidate.phone,
            cvFileUrl: application.candidate.cvFileUrl,
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
    if (!(await this.candidates.existsBy({ id: dto.candidateId }))) {
      throw new BadRequestException('Ứng viên không tồn tại');
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
      const id = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(Application, {
            candidateId: dto.candidateId,
            jobId: dto.jobId,
            assigneeId: assigneeId ?? null,
            note: dto.note ?? null,
            status: ApplicationStatus.NEW,
          }),
        );

        await manager.insert(ApplicationStatusHistory, {
          applicationId: saved.id,
          fromStatus: null,
          toStatus: ApplicationStatus.NEW,
          note: 'Tạo hồ sơ',
          changedById: actor.id,
        });

        return saved.id;
      });

      return await this.get(id, actor);
    } catch (error) {
      return rethrowDbError(error, {
        unique: 'Ứng viên đã nộp hồ sơ vào tin này',
      });
    }
  }

  async assign(
    id: string,
    assigneeId: string | null,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    await this.findScoped(id, actor);
    if (assigneeId) await this.assertAssignable(assigneeId);

    await this.applications.update(id, { assigneeId });
    return this.get(id, actor);
  }

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    const application = await this.findScoped(id, actor);

    await this.dataSource.transaction((manager) =>
      this.workflow.moveTo(
        manager,
        application,
        dto.toStatus,
        actor.id,
        dto.note ?? null,
      ),
    );

    return this.get(id, actor);
  }

  async setNote(
    id: string,
    note: string,
    actor: AuthUser,
  ): Promise<ApplicationDetail> {
    await this.findScoped(id, actor);
    await this.applications.update(id, { note: note === '' ? null : note });
    return this.get(id, actor);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const application = await this.findScoped(id, actor);

    if (application.status !== ApplicationStatus.NEW) {
      throw new ConflictException('Chỉ xóa được hồ sơ ở trạng thái Mới');
    }

    const result = await this.applications.delete({
      id,
      status: ApplicationStatus.NEW,
    });
    if (!result.affected) {
      throw new ConflictException(
        'Hồ sơ vừa được xử lý bởi người khác, vui lòng tải lại',
      );
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
