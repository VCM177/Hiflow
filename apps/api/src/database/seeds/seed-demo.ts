import dataSource from '../typeorm.config';
import { seedDemo } from './demo.seeder';

async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');
  await dataSource.initialize();

  try {
    const summary = await seedDemo(dataSource, { reset });

    if (summary.skipped) {
      console.log(
        'Demo data already exists, nothing changed. Run with --reset to rebuild it.',
      );
      return;
    }

    console.log(
      `Demo data ${reset ? 'rebuilt' : 'created'}: ${summary.requisitions} requisitions, ` +
        `${summary.jobs} jobs, ${summary.candidates} candidates, ` +
        `${summary.applications} applications, ${summary.interviews} interviews, ` +
        `${summary.offers} offers.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
