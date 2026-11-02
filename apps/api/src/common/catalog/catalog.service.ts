import { NotFoundException } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { actorOf } from '../../modules/audit/audit.types';
import { TxRunner } from '../../modules/audit/tx-runner.service';
import { rethrowDbError } from '../errors/db-errors';
import { containsPattern, paginate, Paginated } from '../pagination/paginate';
import type { AuthUser } from '../types/auth-user';
import {
  CatalogInputDto,
  CatalogListQueryDto,
  UpdateCatalogDto,
} from './catalog.dto';

export interface CatalogEntity extends ObjectLiteral {
  id: string;
  name: string;
  code: string;
}

export interface CatalogMessages {
  notFound: string;
  duplicate: string;
  inUse: string;
}

/** The audit events a catalogue writes; each list has its own. */
export interface CatalogEvents {
  created: 'DEPARTMENT_CREATED' | 'POSITION_CREATED';
  updated: 'DEPARTMENT_UPDATED' | 'POSITION_UPDATED';
  deleted: 'DEPARTMENT_DELETED' | 'POSITION_DELETED';
}

/** CRUD shared by simple `name` + `code` reference lists. */
export abstract class CatalogService<T extends CatalogEntity> {
  protected constructor(
    protected readonly repo: Repository<T>,
    private readonly messages: CatalogMessages,
    private readonly tx: TxRunner,
    private readonly events: CatalogEvents,
  ) {}

  list(query: CatalogListQueryDto): Promise<Paginated<T>> {
    const qb = this.repo.createQueryBuilder('item');

    if (query.search) {
      qb.where('(item.name ILIKE :q OR item.code ILIKE :q)', {
        q: containsPattern(query.search),
      });
    }

    // sortBy is validated against a whitelist by the DTO.
    qb.orderBy(
      `item.${query.sortBy}`,
      query.sortDir === 'asc' ? 'ASC' : 'DESC',
    );

    return paginate(qb, query.page, query.limit);
  }

  async get(id: string): Promise<T> {
    const item = await this.repo.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    if (!item) {
      throw new NotFoundException(this.messages.notFound);
    }

    return item;
  }

  async create(dto: CatalogInputDto, actor: AuthUser): Promise<T> {
    try {
      return await this.tx.run(actorOf(actor), async (manager, audit) => {
        const items = manager.getRepository(this.repo.target);
        const saved = await items.save(
          items.create({
            name: dto.name,
            code: dto.code.toUpperCase(),
          } as DeepPartial<T>),
        );
        await audit.record(this.events.created, saved.id);
        return saved;
      });
    } catch (error) {
      return rethrowDbError(error, { unique: this.messages.duplicate });
    }
  }

  async update(id: string, dto: UpdateCatalogDto, actor: AuthUser): Promise<T> {
    const item = await this.get(id);
    const changedFields: string[] = [];
    const name = dto.name;
    const code = dto.code?.toUpperCase();

    if (name !== undefined && name !== item.name) {
      item.name = name;
      changedFields.push('name');
    }
    if (code !== undefined && code !== item.code) {
      item.code = code;
      changedFields.push('code');
    }
    if (changedFields.length === 0) return item;

    try {
      return await this.tx.run(actorOf(actor), async (manager, audit) => {
        const items = manager.getRepository(this.repo.target);
        const saved = await items.save(item);
        await audit.record(this.events.updated, id, { changedFields });
        return saved;
      });
    } catch (error) {
      return rethrowDbError(error, { unique: this.messages.duplicate });
    }
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    try {
      await this.tx.run(actorOf(actor), async (manager, audit) => {
        const result = await manager.getRepository(this.repo.target).delete(id);

        if (!result.affected) {
          throw new NotFoundException(this.messages.notFound);
        }
        await audit.record(this.events.deleted, id);
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      rethrowDbError(error, { foreignKey: this.messages.inUse });
    }
  }
}
