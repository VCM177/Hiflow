import {
  canTransition,
  JobStatus,
  REQUISITION_TRANSITIONS,
  RequisitionStatus,
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
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { endOfDayExclusive, startOfDay, toDateOnly } from '../../common/dates';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import { departmentScope } from '../../common/scope';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditEvent } from '../audit/entities/audit-event.entity';
import { actorOf } from '../audit/audit.types';
import { TxRunner } from '../audit/tx-runner.service';
import { Department } from '../departments/entities/department.entity';
import { Job } from '../jobs/entities/job.entity';
import { JobPosition } from '../positions/entities/job-position.entity';
import { Requisition } from './entities/requisition.entity';
import {
  REQUISITION_CODE_SEQUENCE,
  REQUISITION_STATUS_LABEL,
} from './requisitions.constants';
import {
  CreateRequisitionDto,
  ListRequisitionsQueryDto,
  UpdateRequisitionDto,
} from './requisitions.dto';
import {
  RequisitionEvent,
  RequisitionView,
  toRequisitionView,
} from './requisition-view';

const SORT_COLUMNS: Record<ListRequisitionsQueryDto['sortBy'], string> = {
  code: 'req.code',
  title: 'req.title',
  quantity: 'req.quantity',
  status: 'req.status',
  createdAt: 'req.createdAt',
};

@Injectable()
export class RequisitionsService {
  constructor(
    @InjectRepository(Requisition)
    private readonly requisitions: Repository<Requisition>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(JobPosition)
    private readonly positions: Repository<JobPosition>,
    @InjectRepository(AuditEvent)
    private readonly auditEvents: Repository<AuditEvent>,
    private readonly dataSource: DataSource,
    private readonly tx: TxRunner,
  ) {}

  async list(
    query: ListRequisitionsQueryDto,
    actor: AuthUser,
  ): Promise<Paginated<RequisitionView>> {
    const qb = this.scopedQuery(actor);

    if (query.search) {
      qb.andWhere('(req.code ILIKE :q OR req.title ILIKE :q)', {
        q: containsPattern(query.search),
      });
    }
    if (query.status) {
      qb.andWhere('req.status = :status', { status: query.status });
    }
    if (query.departmentId) {
      qb.andWhere('req.departmentId = :departmentId', {
        departmentId: query.departmentId,
      });
    }
    if (query.createdFrom) {
      qb.andWhere('req.createdAt >= :from', {
        from: startOfDay(query.createdFrom),
      });
    }
    if (query.createdTo) {
      qb.andWhere('req.createdAt < :to', {
        to: endOfDayExclusive(query.createdTo),
      });
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('req.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toRequisitionView), meta: page.meta };
  }

  async get(id: string, actor: AuthUser): Promise<RequisitionView> {
    return toRequisitionView(await this.findScoped(id, actor));
  }

  async history(id: string, actor: AuthUser): Promise<RequisitionEvent[]> {
    await this.findScoped(id, actor);

    const rows = await this.auditEvents.find({
      where: { entityType: 'Requisition', entityId: id },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      // REQUISITION_REJECTED -> REJECTED: the screen speaks in these short codes.
      event: row.event.replace(/^REQUISITION_/, ''),
      actor: row.actorId
        ? { id: row.actorId, name: row.actorName ?? '' }
        : null,
      note:
        row.event === 'REQUISITION_REJECTED'
          ? ((row.data as { reason?: string }).reason ?? null)
          : null,
      at: row.occurredAt,
    }));
  }

  async create(
    dto: CreateRequisitionDto,
    actor: AuthUser,
  ): Promise<RequisitionView> {
    const departmentId = this.resolveDepartment(dto.departmentId, actor);
    this.assertBudget(dto.budgetMin, dto.budgetMax);
    await this.assertReferencesExist(departmentId, dto.positionId);

    const code = await this.nextCode();
    const saved = await this.tx.run(actorOf(actor), async (manager, audit) => {
      const repo = manager.getRepository(Requisition);
      const created = await repo.save(
        repo.create({
          code,
          title: dto.title,
          departmentId,
          positionId: dto.positionId,
          quantity: dto.quantity,
          reason: dto.reason ?? null,
          expectedStartDate: dto.expectedStartDate
            ? toDateOnly(dto.expectedStartDate)
            : null,
          budgetMin: dto.budgetMin ?? null,
          budgetMax: dto.budgetMax ?? null,
          status: RequisitionStatus.DRAFT,
          createdById: actor.id,
        }),
      );
      await audit.record('REQUISITION_CREATED', created.id, { code });
      return created;
    });

    return this.get(saved.id, actor);
  }

  async update(
    id: string,
    dto: UpdateRequisitionDto,
    actor: AuthUser,
  ): Promise<RequisitionView> {
    const requisition = await this.findScoped(id, actor);

    if (
      requisition.status !== RequisitionStatus.DRAFT &&
      requisition.status !== RequisitionStatus.REJECTED
    ) {
      throw new ConflictException(
        'Chỉ sửa được yêu cầu ở trạng thái Nháp hoặc Bị từ chối',
      );
    }

    this.assertBudget(
      dto.budgetMin ?? requisition.budgetMin ?? undefined,
      dto.budgetMax ?? requisition.budgetMax ?? undefined,
    );
    if (dto.positionId) {
      await this.assertReferencesExist(
        requisition.departmentId,
        dto.positionId,
      );
    }

    const changedFields: string[] = [];
    const apply = <K extends keyof Requisition>(
      field: K,
      value: Requisition[K] | undefined,
    ): void => {
      if (value === undefined) return;
      if ((requisition[field] ?? null) === (value ?? null)) return;
      requisition[field] = value;
      changedFields.push(field);
    };

    apply('title', dto.title);
    apply('positionId', dto.positionId);
    apply('quantity', dto.quantity);
    apply('reason', dto.reason);
    apply('budgetMin', dto.budgetMin);
    apply('budgetMax', dto.budgetMax);
    apply(
      'expectedStartDate',
      dto.expectedStartDate === undefined
        ? undefined
        : toDateOnly(dto.expectedStartDate),
    );

    if (changedFields.length > 0) {
      // `position` is loaded by the scoped query; clear it so the new positionId wins.
      requisition.position = undefined;
      await this.tx.run(actorOf(actor), async (manager, audit) => {
        await manager.getRepository(Requisition).save(requisition);
        await audit.record('REQUISITION_UPDATED', id, {
          code: requisition.code,
          changedFields,
        });
      });
    }
    return this.get(id, actor);
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    const requisition = await this.findScoped(id, actor);

    if (requisition.status !== RequisitionStatus.DRAFT) {
      throw new ConflictException('Chỉ xóa được yêu cầu ở trạng thái Nháp');
    }

    await this.tx.run(actorOf(actor), async (manager, audit) => {
      const result = await manager.getRepository(Requisition).delete({
        id,
        status: RequisitionStatus.DRAFT,
      });
      if (!result.affected) {
        throw new ConflictException(
          'Yêu cầu vừa được xử lý bởi người khác, vui lòng tải lại',
        );
      }
      await audit.record('REQUISITION_DELETED', id, {
        code: requisition.code,
      });
    });
  }

  submit(id: string, actor: AuthUser): Promise<RequisitionView> {
    return this.transition(id, RequisitionStatus.PENDING_APPROVAL, actor, {
      rejectReason: null,
    });
  }

  approve(id: string, actor: AuthUser): Promise<RequisitionView> {
    return this.transition(id, RequisitionStatus.APPROVED, actor, {
      approvedById: actor.id,
      approvedAt: new Date(),
      rejectReason: null,
    });
  }

  reject(
    id: string,
    reason: string,
    actor: AuthUser,
  ): Promise<RequisitionView> {
    return this.transition(id, RequisitionStatus.REJECTED, actor, {
      approvedById: null,
      approvedAt: null,
      rejectReason: reason,
    });
  }

  async close(id: string, actor: AuthUser): Promise<RequisitionView> {
    const requisition = await this.findScoped(id, actor);
    this.assertCanTransition(requisition.status, RequisitionStatus.CLOSED);

    // Closing the requisition also stops any job that was opened from it.
    await this.tx.run(actorOf(actor), async (manager, audit) => {
      const result = await manager.update(
        Requisition,
        { id, status: requisition.status },
        { status: RequisitionStatus.CLOSED },
      );
      if (!result.affected) {
        throw new ConflictException(
          'Yêu cầu vừa được xử lý bởi người khác, vui lòng tải lại',
        );
      }

      await manager.update(
        Job,
        {
          requisitionId: id,
          status: In([JobStatus.DRAFT, JobStatus.OPEN]),
        },
        { status: JobStatus.CLOSED },
      );
      await audit.record('REQUISITION_CLOSED', id, {
        code: requisition.code,
      });
    });

    return this.get(id, actor);
  }

  /**
   * Moves a requisition to a new status. The UPDATE is conditioned on the status
   * we read, so if two people act at once only one of them succeeds.
   */
  private async transition(
    id: string,
    to: RequisitionStatus,
    actor: AuthUser,
    changes: Partial<Requisition>,
  ): Promise<RequisitionView> {
    const requisition = await this.findScoped(id, actor);
    this.assertCanTransition(requisition.status, to);

    await this.tx.run(actorOf(actor), async (manager, audit) => {
      const result = await manager
        .getRepository(Requisition)
        .update({ id, status: requisition.status }, { ...changes, status: to });
      if (!result.affected) {
        throw new ConflictException(
          'Yêu cầu vừa được xử lý bởi người khác, vui lòng tải lại',
        );
      }

      const code = requisition.code;
      if (to === RequisitionStatus.REJECTED) {
        await audit.record('REQUISITION_REJECTED', id, {
          code,
          reason: changes.rejectReason ?? '',
        });
      } else if (to === RequisitionStatus.APPROVED) {
        await audit.record('REQUISITION_APPROVED', id, { code });
      } else {
        await audit.record('REQUISITION_SUBMITTED', id, { code });
      }
    });

    return this.get(id, actor);
  }

  private assertCanTransition(
    from: RequisitionStatus,
    to: RequisitionStatus,
  ): void {
    if (!canTransition(REQUISITION_TRANSITIONS, from, to)) {
      throw new ConflictException(
        `Không thể chuyển yêu cầu từ "${REQUISITION_STATUS_LABEL[from]}" sang "${REQUISITION_STATUS_LABEL[to]}"`,
      );
    }
  }

  /** A department manager only ever sees their own department's requisitions. */
  private scopedQuery(actor: AuthUser): SelectQueryBuilder<Requisition> {
    const qb = this.requisitions
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.department', 'department')
      .leftJoinAndSelect('req.position', 'position')
      .leftJoinAndSelect('req.createdBy', 'creator')
      .leftJoinAndSelect('req.approvedBy', 'approver');

    const scope = departmentScope(actor);
    if (scope) {
      qb.andWhere('req.departmentId = :scope', { scope });
    }

    return qb;
  }

  /** Out-of-scope rows answer 404, not 403, so their existence is not revealed. */
  private async findScoped(id: string, actor: AuthUser): Promise<Requisition> {
    const requisition = await this.scopedQuery(actor)
      .andWhere('req.id = :id', { id })
      .getOne();

    if (!requisition) {
      throw new NotFoundException('Không tìm thấy yêu cầu tuyển dụng');
    }

    return requisition;
  }

  private resolveDepartment(
    requested: string | undefined,
    actor: AuthUser,
  ): string {
    if (actor.role === UserRole.DEPT_MANAGER) {
      if (!actor.departmentId) {
        throw new BadRequestException('Tài khoản chưa thuộc phòng ban nào');
      }
      if (requested && requested !== actor.departmentId) {
        throw new ForbiddenException(
          'Chỉ được tạo yêu cầu cho phòng ban của mình',
        );
      }
      return actor.departmentId;
    }

    if (!requested) {
      throw new BadRequestException('Vui lòng chọn phòng ban');
    }
    return requested;
  }

  private assertBudget(min?: number, max?: number): void {
    if (min !== undefined && max !== undefined && max < min) {
      throw new BadRequestException(
        'Ngân sách tối đa không được nhỏ hơn ngân sách tối thiểu',
      );
    }
  }

  private async assertReferencesExist(
    departmentId: string,
    positionId: string,
  ): Promise<void> {
    if (!(await this.departments.existsBy({ id: departmentId }))) {
      throw new BadRequestException('Phòng ban không tồn tại');
    }
    if (!(await this.positions.existsBy({ id: positionId }))) {
      throw new BadRequestException('Vị trí tuyển dụng không tồn tại');
    }
  }

  private async nextCode(): Promise<string> {
    const rows: { value: string }[] = await this.dataSource.query(
      `SELECT nextval('${REQUISITION_CODE_SEQUENCE}') AS value`,
    );

    return `REQ-${new Date().getFullYear()}-${String(rows[0].value).padStart(4, '0')}`;
  }
}
