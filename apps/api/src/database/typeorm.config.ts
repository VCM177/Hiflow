import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// Loaded here (not only by ConfigModule) so the TypeORM CLI sees the URLs.
config({ quiet: true });

const shared: Omit<PostgresConnectionOptions, 'url'> = {
  type: 'postgres',
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
};

/** What the running API uses: the restricted `hiflow_app` role (DATABASE_URL). */
export const dataSourceOptions: DataSourceOptions = {
  ...shared,
  url: process.env.DATABASE_URL,
  // A test run tags every write of its sessions, so its audit rows can be told
  // apart from real activity and wiped afterwards.
  extra:
    process.env.AUDIT_ORIGIN === 'e2e'
      ? { options: '-c hiflow.origin=e2e' }
      : undefined,
};

/**
 * The owner role, for migrations, seeds and maintenance. Falls back to
 * DATABASE_URL so a setup with a single role keeps working, but the API then
 * refuses to start (see `AuditGuardCheck`).
 */
export const ownerDataSourceOptions: DataSourceOptions = {
  ...shared,
  url: process.env.DATABASE_OWNER_URL ?? process.env.DATABASE_URL,
};

// The TypeORM CLI and the seed scripts import this one.
export default new DataSource(ownerDataSourceOptions);
