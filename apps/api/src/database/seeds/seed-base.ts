import dataSource from '../typeorm.config';
import { seedBase, seedPassword } from './base.seeder';

async function main(): Promise<void> {
  await dataSource.initialize();

  try {
    const summary = await seedBase(dataSource, seedPassword());

    console.log(
      `Base seed done. New rows: ${summary.departments} departments, ` +
        `${summary.positions} positions, ${summary.users} users.`,
    );

    if (!process.env.SEED_DEFAULT_PASSWORD) {
      console.warn(
        'SEED_DEFAULT_PASSWORD is not set: demo accounts use the default demo password.',
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
