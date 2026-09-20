import {
  canTransition,
  JOB_TRANSITIONS,
  JobStatus,
  RequisitionStatus,
} from '@hiflow/shared-types';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { endOfDayExclusive, startOfDay } from '../../common/dates';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import { departmentScope } from '../../common/scope';
import type { AuthUser } from '../../common/types/auth-user';
import { Application } from '../applications/entities/application.entity';
import { Requisition } from '../requisitions/entities/requisition.entity';
import { Job } from './entities/job.entity';
import { JOB_STATUS_LABEL } from './jobs.constants';
import { CreateJobDto, ListJobsQueryDto, UpdateJobDto } from './jobs.dto';
import { JobView, toJobView } from './job-view';

const SORT_COLUMNS: Record<ListJobsQueryDto['sortBy'], string> = {
  title: 'job.title',
  status: 'job.status',
  quantity: 'job.quantity',
  createdAt: 'job.createdAt',
  publishedAt: 'job.publishedAt',
};

const RACE_MESSAGE = 'Tin vừa được xử lý bởi người khác, vui lòng tải lại';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Requisition)
    private readonly requisitions: Repository<Requisition>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
  ) {}

  async list(
    query: ListJobsQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<JobView>> {
    const qb = this.scopedQuery(actor);

    if (query.search) {
      qb.andWhere('job.title ILIKE :q', { q: containsPattern(query.search) });
    }
    if (query.status) {
      qb.andWhere('job.status = :status', { status: query.status });
    }
    if (query.departmentId) {
      qb.andWhere('job.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.positionId) {
      qb.andWhere('job.positionId = :positionId', {
        positionId: query.positionId,
      });
    }
    if (query.requisitionId) {
      qb.andWhere('job.requisitionId = :requisitionId', {
        requisitionId: query.requisitionId,
      });
    }
    if (query.createdFrom) {
      qb.andWhere('job.createdAt >= :from', {
        from: startOfDay(query.createdFrom),
      });
    }
    if (query.createdTo) {
      qb.andWhere('job.createdAt < :to', {
        to: endOfDayExclusive(query.createdTo),
      });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('job.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    const counts = await this.countApplications(page.items.map((j) => j.id));

    return {
      items: page.items.map((job) => toJobView(job, counts.get(job.id) ?? 0)),
      meta: page.meta,
    };
  }

  async get(id: string, actor: AuthUser): Promise<JobView> {
    const job = await this.findScoped(id, actor);
    const counts = await this.countApplications([id]);

    return toJobView(job, counts.get(id) ?? 0);
  }

  async create(dto: CreateJobDto, actor: AuthUser): Promise<JobView> {
    const requisition = await this.requisitions.findOne({
      where: { id: dto.requisitionId },
    });

    if (!requisition) {
      throw new BadRequestException('Yêu cầu tuyển dụng không tồn tại');
    }
    if (requisition.status !== RequisitionStatus.APPROVED) {
      throw new ConflictException('Chỉ tạo tin từ yêu cầu đã được duyệt');
    }

    const quantity = dto.quantity ?? requisition.quantity;
    await this.assertWithinApprovedHeadcount(requisition, quantity);
    this.assertSalary(dto.salaryMin, dto.salaryMax);

    const saved = await this.jobs.save(
      this.jobs.create({
        requisitionId: requisition.id,
        title: dto.title ?? requisition.title,
        positionId: requisition.positionId,
        departmentId: requisition.departmentId,
        quantity,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        location: dto.location ?? null,
        description: dto.description ?? null,
        status: JobStatus.DRAFT,
        createdById: actor.id,
      }),
    );

    return this.get(saved.id, actor);
  }

  async update(
    id: string,
    dto: UpdateJobDto,
    actor: AuthUser,
  ): Promise<JobView> {
    const job = await this.findScoped(id, actor);

    if (job.status === JobStatus.CLOSED) {
      throw new ConflictException('Không thể sửa tin đã đóng');
    }

    this.assertSalary(
      dto.salaryMin ?? job.salaryMin ?? undefined,
      dto.salaryMax ?? job.salaryMax ?? undefined,
    );
    if (dto.quantity !== undefined && dto.quantity !== job.quantity) {
      const requisition = await this.requisitions.findOneByOrFail({
        id: job.requisitionId,
      });
      await this.assertWithinApprovedHeadcount(
        requisition,
        dto.quantity,
        job.id,
      );
    }

    if (dto.title !== undefined) job.title = dto.title;
    if (dto.quantity !== undefined) job.quantity = dto.quantity;
    if (dto.salaryMin !== undefined) job.salaryMin = dto.salaryMin;
    if (dto.salaryMax !== undefined) job.salaryMax = dto.salaryMax;
    if (dto.location !== undefined) job.location = dto.location;
    if (dto.description !== undefined) job.description = dto.description;

    await this.jobs.save(job);
    return this.get(id, actor);
  }

  async publish(id: string, actor: AuthUser): Promise<JobView> {
    const job = await this.findScoped(id, actor);
    this.assertCanTransition(job.status, JobStatus.OPEN);

    const requisition = await this.requisitions.findOneByOrFail({
      id: job.requisitionId,
    });
    if (requisition.status !== RequisitionStatus.APPROVED) {
      throw new ConflictException(
        'Không thể đăng tin khi yêu cầu tuyển dụng không còn ở trạng thái Đã duyệt',
      );
    }

    return this.changeStatus(job, JobStatus.OPEN, actor, {
      publishedAt: new Date(),
    });
  }

  stop(id: string, actor: AuthUser): Promise<JobView> {
    return this.findScoped(id, actor).then((job) => {
      this.assertCanTransition(job.status, JobStatus.CLOSED);
      return this.changeStatus(job, JobStatus.CLOSED, actor, {});
    });
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const job = await this.findScoped(id, actor);

    if (job.status !== JobStatus.DRAFT) {
      throw new ConflictException('Chỉ xóa được tin ở trạng thái Nháp');
    }

    const result = await this.jobs.delete({ id, status: JobStatus.DRAFT });
    if (!result.affected) {
      throw new ConflictException(RACE_MESSAGE);
    }
  }

  /** The UPDATE is conditioned on the status we read, so concurrent calls cannot both win. */
  private async changeStatus(
    job: Job,
    to: JobStatus,
    actor: AuthUser,
    changes: Partial<Pick<Job, 'publishedAt'>>,
  ): Promise<JobView> {
    const result = await this.jobs.update(
      { id: job.id, status: job.status },
      { ...changes, status: to },
    );
    if (!result.affected) {
      throw new ConflictException(RACE_MESSAGE);
    }

    return this.get(job.id, actor);
  }

  private assertCanTransition(from: JobStatus, to: JobStatus): void {
    if (!canTransition(JOB_TRANSITIONS, from, to)) {
      throw new ConflictException(
        `Không thể chuyển tin từ "${JOB_STATUS_LABEL[from]}" sang "${JOB_STATUS_LABEL[to]}"`,
      );
    }
  }

  /** Open positions across a requisition's live jobs may not exceed what was approved. */
  private async assertWithinApprovedHeadcount(
    requisition: Requisition,
    quantity: number,
    excludeJobId?: string,
  ): Promise<void> {
    const qb = this.jobs
      .createQueryBuilder('job')
      .select('COALESCE(SUM(job.quantity), 0)', 'total')
      .where('job.requisitionId = :requisitionId', {
        requisitionId: requisition.id,
      })
      .andWhere({ status: Not(JobStatus.CLOSED) });

    if (excludeJobId) {
      qb.andWhere('job.id != :excludeJobId', { excludeJobId });
    }

    const { total } = (await qb.getRawOne<{ total: string }>()) ?? {
      total: '0',
    };
    const remaining = requisition.quantity - Number(total);

    if (quantity > remaining) {
      throw new ConflictException(
        `Vượt quá số lượng đã duyệt của yêu cầu (còn lại ${Math.max(remaining, 0)})`,
      );
    }
  }

  private assertSalary(min?: number, max?: number): void {
    if (min !== undefined && max !== undefined && max < min) {
      throw new BadRequestException(
        'Mức lương tối đa không được nhỏ hơn mức lương tối thiểu',
      );
    }
  }

  private async countApplications(
    jobIds: string[],
  ): Promise<Map<string, number>> {
    if (jobIds.length === 0) return new Map();

    const rows = await this.applications
      .createQueryBuilder('application')
      .select('application.jobId', 'jobId')
      .addSelect('COUNT(*)', 'count')
      .where({ jobId: In(jobIds) })
      .groupBy('application.jobId')
      .getRawMany<{ jobId: string; count: string }>();

    return new Map(rows.map((row) => [row.jobId, Number(row.count)]));
  }

  private scopedQuery(actor: AuthUser): SelectQueryBuilder<Job> {
    const qb = this.jobs
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.requisition', 'requisition')
      .leftJoinAndSelect('job.department', 'department')
      .leftJoinAndSelect('job.position', 'position')
      .leftJoinAndSelect('job.createdBy', 'creator');

    const scope = departmentScope(actor);
    if (scope) {
      qb.andWhere('job.departmentId = :scope', { scope });
    }

    return qb;
  }

  private async findScoped(id: string, actor: AuthUser): Promise<Job> {
    const job = await this.scopedQuery(actor)
      .andWhere('job.id = :id', { id })
      .getOne();

    if (!job) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    return job;
  }
}
