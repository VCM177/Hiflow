import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { TxRunner } from '../audit/tx-runner.service';
import type { StorageService } from '../storage/storage.service';
import { CandidateAnonymizerService } from './candidate-anonymizer.service';

describe('CandidateAnonymizerService.sweep', () => {
  const build = () => {
    const service = new CandidateAnonymizerService(
      {} as DataSource,
      {} as StorageService,
      {} as TxRunner,
    );
    const anonymize = jest.spyOn(service, 'anonymize');
    jest.spyOn(service, 'findExpired').mockResolvedValue(['a', 'b', 'c', 'd']);
    return { service, anonymize };
  };

  it('only counts in a dry run and erases nothing', async () => {
    const { service, anonymize } = build();

    await expect(service.sweep(12, true)).resolves.toEqual({
      found: 4,
      anonymized: 0,
      skipped: 0,
      failed: 0,
    });
    expect(anonymize).not.toHaveBeenCalled();
  });

  it('keeps going when one candidate cannot be erased', async () => {
    const { service, anonymize } = build();
    anonymize
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ConflictException('đang có hồ sơ mới'))
      .mockRejectedValueOnce(new Error('storage down'))
      .mockResolvedValueOnce(undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.sweep(12)).resolves.toEqual({
      found: 4,
      anonymized: 2,
      skipped: 1,
      failed: 1,
    });
    expect(anonymize.mock.calls.map(([id]) => id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    // A retention run has no person behind it, and says so.
    expect(
      anonymize.mock.calls.every(
        ([, who, why]) => who === null && why === 'RETENTION',
      ),
    ).toBe(true);
  });
});
