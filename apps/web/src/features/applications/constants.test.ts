import { ApplicationStatus } from '@hiflow/shared-types';
import { describe, expect, it } from 'vitest';

import { APPLICATION_STATUS_MAP } from './constants';

describe('APPLICATION_STATUS_MAP', () => {
  it('covers every status with a label', () => {
    for (const status of Object.values(ApplicationStatus)) {
      expect(APPLICATION_STATUS_MAP[status].label).toBeTruthy();
    }
  });
});
