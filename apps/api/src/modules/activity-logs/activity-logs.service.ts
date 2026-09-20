import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CsvColumn, toCsv } from '../../common/csv';
import { endOfDayExclusive, startOfDay } from '../../common/dates';
import {
  containsPattern,
  paginate,
  Paginated,
} from '../../common/pagination/paginate';
import {
  ActivityLogCsvRow,
  ActivityLogView,
  toActivityLogView,
  toCsvRow,
} from './activity-log-view';
import {
  ActivityLogFilterDto,
  ListActivityLogsQueryDto,
} from './activity-logs.dto';
import { ActivityLog } from './entities/activity-log.entity';

const SORT_COLUMNS: Record<ListActivityLogsQueryDto['sortBy'], string> = {
  createdAt: 'log.createdAt',
  entityType: 'log.entityType',
  action: 'log.action',
};

/** An export is a snapshot, not a database dump: it is capped. */
export const EXPORT_ROW_LIMIT = 10_000;

const EXPORT_COLUMNS: CsvColumn<ActivityLogCsvRow>[] = [
  { key: 'createdAt', label: 'Thời gian' },
  { key: 'actor', label: 'Người thực hiện' },
  { key: 'action', label: 'Thao tác' },
  { key: 'entityType', label: 'Đối tượng' },
  { key: 'entityId', label: 'Mã đối tượng' },
  { key: 'route', label: 'Đường dẫn' },
];

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly logs: Repository<ActivityLog>,
  ) {}

  async list(
    query: ListActivityLogsQueryDto,
  ): Promise<Paginated<ActivityLogView>> {
    const qb = this.filtered(query);

    if (query.search) {
      qb.andWhere(
        '(actor.fullName ILIKE :q OR log.entityType ILIKE :q OR log.entityId ILIKE :q)',
        { q: containsPattern(query.search) },
      );
    }

    qb.orderBy(
      SORT_COLUMNS[query.sortBy],
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    ).addOrderBy('log.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toActivityLogView), meta: page.meta };
  }

  async get(id: string): Promise<ActivityLogView> {
    const log = await this.logs.findOne({
      where: { id },
      relations: { actor: true },
    });

    if (!log) {
      throw new NotFoundException('Không tìm thấy bản ghi nhật ký');
    }

    return toActivityLogView(log);
  }

  async exportCsv(filter: ActivityLogFilterDto): Promise<string> {
    const logs = await this.filtered(filter)
      .orderBy('log.createdAt', 'DESC')
      .addOrderBy('log.id', 'ASC')
      .take(EXPORT_ROW_LIMIT)
      .getMany();

    return toCsv(EXPORT_COLUMNS, logs.map(toActivityLogView).map(toCsvRow));
  }

  private filtered(
    filter: ActivityLogFilterDto,
  ): SelectQueryBuilder<ActivityLog> {
    const qb = this.logs
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor');

    if (filter.actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId: filter.actorId });
    }
    if (filter.action) {
      qb.andWhere('log.action = :action', { action: filter.action });
    }
    if (filter.entityType) {
      qb.andWhere('log.entityType = :entityType', {
        entityType: filter.entityType,
      });
    }
    if (filter.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filter.entityId });
    }
    if (filter.from) {
      qb.andWhere('log.createdAt >= :from', { from: startOfDay(filter.from) });
    }
    if (filter.to) {
      qb.andWhere('log.createdAt < :to', { to: endOfDayExclusive(filter.to) });
    }

    return qb;
  }
}
