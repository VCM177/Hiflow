import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { retentionMonths } from '../config/retention';
import { CandidateAnonymizerService } from '../modules/candidates/candidate-anonymizer.service';

/**
 * Anonymises candidates whose data has outlived the retention period. Meant for
 * a scheduler; `--dry-run` only reports how many candidates would be affected.
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const months = retentionMonths(process.env.CANDIDATE_RETENTION_MONTHS);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const result = await app
      .get(CandidateAnonymizerService)
      .sweep(months, dryRun);

    console.log(
      `${dryRun ? 'Dry run' : 'Retention run'} (${months} months): ` +
        `${result.found} found, ${result.anonymized} anonymised, ` +
        `${result.skipped} skipped, ${result.failed} failed.`,
    );

    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
