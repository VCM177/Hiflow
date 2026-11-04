import {
  type AuditEventDetail,
  type AuditEventView,
} from '@hiflow/shared-types';
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
  AuditEventCsvRow,
  toAuditCsvRow,
  toAuditEventView,
  toAuditRowChangeView,
} from './audit-event-view';
import {
  AuditEventFilterDto,
  ListAuditEventsQueryDto,
} from './audit-events.dto';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditRowChange } from './entities/audit-row-change.entity';

/** An export is a snapshot, not a database dump: it is capped. */
export const AUDIT_EXPORT_ROW_LIMIT = 10_000;

const EXPORT_COLUMNS: CsvColumn<AuditEventCsvRow>[] = [
  { key: 'occurredAt', label: 'Thời gian' },
  { key: 'label', label: 'Hành động' },
  { key: 'event', label: 'Mã sự kiện' },
  { key: 'actor', label: 'Người thực hiện' },
  { key: 'role', label: 'Vai trò' },
  { key: 'entityType', label: 'Đối tượng' },
  { key: 'entityId', label: 'Mã đối tượng' },
  { key: 'origin', label: 'Nguồn' },
  { key: 'ip', label: 'Địa chỉ IP' },
  { key: 'data', label: 'Chi tiết' },
];

@Injectable()
export class AuditEventsService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
    @InjectRepository(AuditRowChange)
    private readonly changes: Repository<AuditRowChange>,
  ) {}

  async list(
    query: ListAuditEventsQueryDto,
  ): Promise<Paginated<AuditEventView>> {
    const qb = this.filtered(query);

    if (query.search) {
      qb.andWhere('e.actorName ILIKE :q', { q: containsPattern(query.search) });
    }

    qb.orderBy('e.occurredAt', query.sortDir === 'asc' ? 'ASC' : 'DESC')
      // A stable tie-break: events of one transaction share their second.
      .addOrderBy('e.id', 'ASC');

    const page = await paginate(qb, query.page, query.limit);
    return { items: page.items.map(toAuditEventView), meta: page.meta };
  }

  async get(id: string): Promise<AuditEventDetail> {
    const event = await this.events.findOneBy({ id });

    if (!event) {
      throw new NotFoundException('Không tìm thấy sự kiện nhật ký');
    }

    const rowChanges = await this.changes.find({
      where: { txId: event.txId },
      order: { id: 'ASC' },
    });

    return {
      ...toAuditEventView(event),
      rowChanges: rowChanges.map(toAuditRowChangeView),
    };
  }

  /** The CSV and how many rows it holds, so the export itself can be recorded. */
  async exportCsv(
    filter: AuditEventFilterDto,
  ): Promise<{ csv: string; rows: number }> {
    const events = await this.filtered(filter)
      .orderBy('e.occurredAt', 'DESC')
      .addOrderBy('e.id', 'ASC')
      .take(AUDIT_EXPORT_ROW_LIMIT)
      .getMany();

    return {
      csv: toCsv(
        EXPORT_COLUMNS,
        events.map(toAuditEventView).map(toAuditCsvRow),
      ),
      rows: events.length,
    };
  }

  private filtered(
    filter: AuditEventFilterDto,
  ): SelectQueryBuilder<AuditEvent> {
    const qb = this.events.createQueryBuilder('e');

    if (filter.event) qb.andWhere('e.event = :event', { event: filter.event });
    if (filter.entityType) {
      qb.andWhere('e.entityType = :entityType', {
        entityType: filter.entityType,
      });
    }
    if (filter.entityId) {
      qb.andWhere('e.entityId = :entityId', { entityId: filter.entityId });
    }
    if (filter.actorId) {
      qb.andWhere('e.actorId = :actorId', { actorId: filter.actorId });
    }
    if (filter.origin)
      qb.andWhere('e.origin = :origin', { origin: filter.origin });
    if (filter.from) {
      qb.andWhere('e.occurredAt >= :from', { from: startOfDay(filter.from) });
    }
    if (filter.to) {
      qb.andWhere('e.occurredAt < :to', { to: endOfDayExclusive(filter.to) });
    }

    return qb;
  }
}
