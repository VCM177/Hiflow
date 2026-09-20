import * as bcrypt from 'bcryptjs';
import {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Department } from '../../modules/departments/entities/department.entity';
import { JobPosition } from '../../modules/positions/entities/job-position.entity';
import { User } from '../../modules/users/entities/user.entity';
import { DEPARTMENTS, POSITIONS, USERS } from './base-seed.data';

export const DEFAULT_SEED_PASSWORD = 'Hiflow@2026';

export const seedPassword = (): string =>
  process.env.SEED_DEFAULT_PASSWORD || DEFAULT_SEED_PASSWORD;

export interface SeedSummary {
  departments: number;
  positions: number;
  users: number;
}

/** Inserts rows, skipping any that collide; returns how many were new. */
async function insertIgnoring<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  rows: QueryDeepPartialEntity<T>[],
): Promise<number> {
  const result = await manager
    .createQueryBuilder()
    .insert()
    .into(entity)
    .values(rows)
    .orIgnore()
    .execute();

  return (result.raw as unknown[]).length;
}

/**
 * Idempotent: running it again adds nothing and never overwrites an existing
 * account (so a changed password survives a re-seed).
 */
export async function seedBase(
  dataSource: DataSource,
  password: string,
): Promise<SeedSummary> {
  const passwordHash = await bcrypt.hash(password, 10);

  return dataSource.transaction(async (manager) => {
    const departments = await insertIgnoring(manager, Department, DEPARTMENTS);
    const positions = await insertIgnoring(manager, JobPosition, POSITIONS);

    const departmentIdByCode = new Map(
      (await manager.find(Department)).map((row) => [row.code, row.id]),
    );

    const users = await insertIgnoring(
      manager,
      User,
      USERS.map(({ departmentCode, ...user }) => ({
        ...user,
        passwordHash,
        isActive: true,
        departmentId: departmentCode
          ? (departmentIdByCode.get(departmentCode) ?? null)
          : null,
      })),
    );

    return { departments, positions, users };
  });
}
