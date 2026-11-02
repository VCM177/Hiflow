import { DataSource } from 'typeorm';
import { ownerDataSourceOptions } from './../../src/database/typeorm.config';

/**
 * A connection as the owner role, with audit capture off. The API runs as a restricted role that can
 * neither rewrite the audit tables nor, once capture is enforced, write without
 * a transaction context, so a test that builds or removes data by hand does it here.
 */
export async function openMaintenance(): Promise<DataSource> {
  const dataSource = new DataSource({
    ...ownerDataSourceOptions,
    // Test data is set up and removed here, not something the trail should record.
    extra: { options: '-c hiflow.capture=off' },
  });
  await dataSource.initialize();
  return dataSource;
}
