import {
  ApplicationStatus,
  InterviewResult,
  UserRole,
} from '@hiflow/shared-types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { endOfDayExclusive, startOfDay } from '../../common/dates';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import type { AuthUser } from '../../common/types/auth-user';
import { Application } from '../applications/entities/application.entity';
import { actorOf } from '../audit/audit.types';
import type { AuditRecorder } from '../audit/audit.types';
import { TxRunner } from '../audit/tx-runner.service';
import { User } from '../users/entities/user.entity';
import { Interview } from './entities/interview.entity';
import {
  INTERVIEW_SLOT_MINUTES,
  INTERVIEWER_ROLES,
  OWN_INTERVIEWS_ONLY,
  RACE_MESSAGE,
} from './interviews.constants';
import {
  CreateInterviewDto,
  ListInterviewsQueryDto,
  RecordResultDto,
  UpdateInterviewDto,
} from './interviews.dto';
import { InterviewView, toInterviewView } from './interview-view';

const SORT_COLUMNS: Record<ListInterviewsQueryDto['sortBy'], string> = {
  scheduledAt: 'interview.scheduledAt',
  round: 'interview.round',
  result: 'interview.result',
  createdAt: 'interview.createdAt',
};

const MINUTE_MS = 60_000;

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    @InjectRepository(Application)
    private readonly applications: Repository<Application>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly tx: TxRunner,
  ) {}

  async list(
    query: ListInterviewsQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<InterviewView>> {
    const qb = this.scopedQuery(actor);

    if (query.search) {
      qb.andWhere('(candidate.fullName ILIKE :q OR job.title ILIKE :q)', {
        q: containsPattern(query.search),
      });
    }
    if (query.result) {
      qb.andWhere('interview.result = :result', { result: query.result });
    }
    if (query.applicationId) {
      qb.andWhere('interview.applicationId = :applicationId', {
        applicationId: query.applicationId,
      });
    }
    if (query.interviewerId) {
      qb.andWhere('interview.interviewerId = :interviewerId', {
        interviewerId: query.interviewerId,
      });
    }
    if (query.round) {
      qb.andWhere('interview.round = :round', { round: query.round });
    }
    if (query.scheduledFrom) {
      qb.andWhere('interview.scheduledAt >= :from', {
        from: startOfDay(query.scheduledFrom),
      });
    }
    if (query.scheduledTo) {
      qb.andWhere('interview.scheduledAt < :to', {
        to: endOfDayExclusive(query.scheduledTo),
      });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('interview.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toInterviewView), meta: page.meta };
  }

  async get(id: string, actor: AuthUser): Promise<InterviewView> {
    return toInterviewView(await this.findScoped(id, actor));
  }

  async create(
    dto: CreateInterviewDto,
    actor: AuthUser,
  ): Promise<InterviewView> {
    const application = await this.applications.findOneBy({
      id: dto.applicationId,
    });
    if (!application) {
      throw new BadRequestException('Hồ sơ ứng tuyển không tồn tại');
    }
    if (application.status !== ApplicationStatus.INTERVIEW) {
      throw new ConflictException(
        'Chỉ đặt lịch khi hồ sơ đang ở trạng thái Phỏng vấn',
      );
    }
    if (
      await this.interviews.existsBy({
        applicationId: application.id,
        result: InterviewResult.PENDING,
      })
    ) {
      throw new ConflictException(
        'Hồ sơ đang có lịch phỏng vấn chưa có kết quả',
      );
    }

    const scheduledAt = this.parseFuture(dto.scheduledAt);
    await this.assertInterviewer(dto.interviewerId);
    await this.assertNoClash(dto.interviewerId, scheduledAt);

    const round = dto.round ?? (await this.nextRound(application.id));
    await this.assertRoundFree(application.id, round);

    const saved = await this.tx.run(actorOf(actor), async (manager, audit) => {
      const repo = manager.getRepository(Interview);
      const created = await repo.save(
        repo.create({
          applicationId: application.id,
          interviewerId: dto.interviewerId,
          scheduledAt,
          round,
          result: InterviewResult.PENDING,
        }),
      );
      await audit.record('INTERVIEW_SCHEDULED', created.id);
      return created;
    });

    return this.get(saved.id, actor);
  }

  async update(
    id: string,
    dto: UpdateInterviewDto,
    actor: AuthUser,
  ): Promise<InterviewView> {
    const interview = await this.findScoped(id, actor);
    this.assertPending(interview);

    const changedFields: string[] = [];

    if (dto.scheduledAt !== undefined || dto.interviewerId !== undefined) {
      const scheduledAt =
        dto.scheduledAt !== undefined
          ? this.parseFuture(dto.scheduledAt)
          : interview.scheduledAt;
      const interviewerId = dto.interviewerId ?? interview.interviewerId;

      if (dto.interviewerId !== undefined) {
        await this.assertInterviewer(dto.interviewerId);
      }
      await this.assertNoClash(interviewerId, scheduledAt, id);

      if (scheduledAt.getTime() !== interview.scheduledAt.getTime()) {
        interview.scheduledAt = scheduledAt;
        changedFields.push('scheduledAt');
      }
      if (interviewerId !== interview.interviewerId) {
        interview.interviewerId = interviewerId;
        changedFields.push('interviewerId');
      }
    }

    if (dto.round !== undefined && dto.round !== interview.round) {
      await this.assertRoundFree(interview.applicationId, dto.round, id);
      interview.round = dto.round;
      changedFields.push('round');
    }

    if (changedFields.length > 0) {
      // Relations are loaded for the view; clear them so the new ids are written.
      interview.interviewer = undefined;
      interview.application = undefined;
      await this.tx.run(actorOf(actor), async (manager, audit) => {
        await manager.getRepository(Interview).save(interview);
        await audit.record('INTERVIEW_UPDATED', id, { changedFields });
      });
    }
    return this.get(id, actor);
  }

  async cancel(id: string, actor: AuthUser): Promise<InterviewView> {
    const interview = await this.findScoped(id, actor);
    this.assertPending(interview);

    await this.settle(id, InterviewResult.CANCELLED, null, actor, (audit) =>
      audit.record('INTERVIEW_CANCELLED', id, { reason: null }),
    );
    return this.get(id, actor);
  }

  async recordResult(
    id: string,
    dto: RecordResultDto,
    actor: AuthUser,
  ): Promise<InterviewView> {
    const interview = await this.findScoped(id, actor);

    // An HR manager sees every interview but, like anyone else on a panel,
    // only decides their own. An admin may decide on anyone's behalf.
    if (actor.role !== UserRole.ADMIN && interview.interviewerId !== actor.id) {
      throw new ForbiddenException(
        'Chỉ người được xếp phỏng vấn mới nhập được kết quả',
      );
    }
    this.assertPending(interview);

    if (dto.result === InterviewResult.FAILED && !dto.feedback) {
      throw new BadRequestException('Vui lòng nhập nhận xét khi không đạt');
    }

    await this.settle(id, dto.result, dto.feedback ?? null, actor, (audit) =>
      audit.record('INTERVIEW_RESULT_RECORDED', id, { result: dto.result }),
    );
    return this.get(id, actor);
  }

  /** Conditioned on PENDING, so two simultaneous decisions cannot both apply. */
  private async settle(
    id: string,
    result: InterviewResult,
    feedback: string | null,
    actor: AuthUser,
    record: (audit: AuditRecorder) => Promise<void>,
  ): Promise<void> {
    await this.tx.run(actorOf(actor), async (manager, audit) => {
      const outcome = await manager
        .getRepository(Interview)
        .update({ id, result: InterviewResult.PENDING }, { result, feedback });
      if (!outcome.affected) {
        throw new ConflictException(RACE_MESSAGE);
      }
      await record(audit);
    });
  }

  private assertPending(interview: Interview): void {
    if (interview.result !== InterviewResult.PENDING) {
      throw new ConflictException(
        'Lịch phỏng vấn đã có kết quả hoặc đã bị hủy',
      );
    }
  }

  /** An interviewer or department manager only sees the interviews assigned to them. */
  private scopedQuery(actor: AuthUser): SelectQueryBuilder<Interview> {
    const qb = this.interviews
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.application', 'application')
      .leftJoinAndSelect('application.candidate', 'candidate')
      .leftJoinAndSelect('application.job', 'job')
      .leftJoinAndSelect('interview.interviewer', 'interviewer');

    if (OWN_INTERVIEWS_ONLY.includes(actor.role)) {
      qb.andWhere('interview.interviewerId = :me', { me: actor.id });
    }

    return qb;
  }

  private async findScoped(id: string, actor: AuthUser): Promise<Interview> {
    const interview = await this.scopedQuery(actor)
      .andWhere('interview.id = :id', { id })
      .getOne();

    if (!interview) {
      throw new NotFoundException('Không tìm thấy lịch phỏng vấn');
    }

    return interview;
  }

  private parseFuture(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new BadRequestException('Thời gian phỏng vấn phải ở tương lai');
    }

    return date;
  }

  private async assertInterviewer(userId: string): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });

    if (!user || !user.isActive) {
      throw new BadRequestException(
        'Người phỏng vấn không tồn tại hoặc đã bị khóa',
      );
    }
    if (!INTERVIEWER_ROLES.includes(user.role)) {
      throw new BadRequestException(
        'Người phỏng vấn phải là phỏng vấn viên, trưởng bộ phận hoặc quản lý nhân sự',
      );
    }
  }

  /** The same person cannot be booked twice within one interview slot. */
  private async assertNoClash(
    interviewerId: string,
    at: Date,
    excludeId?: string,
  ): Promise<void> {
    const slot = INTERVIEW_SLOT_MINUTES * MINUTE_MS;

    const qb = this.interviews
      .createQueryBuilder('interview')
      .where('interview.interviewerId = :interviewerId', { interviewerId })
      .andWhere('interview.result != :cancelled', {
        cancelled: InterviewResult.CANCELLED,
      })
      .andWhere(
        'interview.scheduledAt > :from AND interview.scheduledAt < :to',
        {
          from: new Date(at.getTime() - slot),
          to: new Date(at.getTime() + slot),
        },
      );

    if (excludeId) {
      qb.andWhere('interview.id != :excludeId', { excludeId });
    }

    if (await qb.getExists()) {
      throw new ConflictException(
        'Người phỏng vấn đã có lịch trong khung giờ này',
      );
    }
  }

  private async nextRound(applicationId: string): Promise<number> {
    const row = await this.interviews
      .createQueryBuilder('interview')
      .select('COALESCE(MAX(interview.round), 0)', 'max')
      .where('interview.applicationId = :applicationId', { applicationId })
      .andWhere('interview.result != :cancelled', {
        cancelled: InterviewResult.CANCELLED,
      })
      .getRawOne<{ max: string }>();

    return Number(row?.max ?? 0) + 1;
  }

  private async assertRoundFree(
    applicationId: string,
    round: number,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.interviews
      .createQueryBuilder('interview')
      .where('interview.applicationId = :applicationId', { applicationId })
      .andWhere('interview.round = :round', { round })
      .andWhere('interview.result != :cancelled', {
        cancelled: InterviewResult.CANCELLED,
      });

    if (excludeId) {
      qb.andWhere('interview.id != :excludeId', { excludeId });
    }

    if (await qb.getExists()) {
      throw new ConflictException(`Vòng ${round} đã có lịch phỏng vấn`);
    }
  }
}
