import { NotFoundException } from '@nestjs/common';
import {
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { rethrowDbError } from '../errors/db-errors';
import { containsPattern, paginate, Paginated } from '../pagination/paginate';
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

/** CRUD shared by simple `name` + `code` reference lists. */
export abstract class CatalogService<T extends CatalogEntity> {
  protected constructor(
    protected readonly repo: Repository<T>,
    private readonly messages: CatalogMessages,
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

  async create(dto: CatalogInputDto): Promise<T> {
    try {
      return await this.repo.save(
        this.repo.create({
          name: dto.name,
          code: dto.code.toUpperCase(),
        } as DeepPartial<T>),
      );
    } catch (error) {
      return rethrowDbError(error, { unique: this.messages.duplicate });
    }
  }

  async update(id: string, dto: UpdateCatalogDto): Promise<T> {
    const item = await this.get(id);

    if (dto.name !== undefined) item.name = dto.name;
    if (dto.code !== undefined) item.code = dto.code.toUpperCase();

    try {
      return await this.repo.save(item);
    } catch (error) {
      return rethrowDbError(error, { unique: this.messages.duplicate });
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const result = await this.repo.delete(id);

      if (!result.affected) {
        throw new NotFoundException(this.messages.notFound);
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      rethrowDbError(error, { foreignKey: this.messages.inUse });
    }
  }
}
