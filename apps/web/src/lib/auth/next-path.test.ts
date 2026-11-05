import { describe, expect, it } from 'vitest';

import { loginUrlFor } from './next-path';

describe('loginUrlFor', () => {
  it('encodes the page the visitor asked for', () => {
    expect(loginUrlFor('/jobs?status=OPEN&page=2')).toBe(
      '/login?next=%2Fjobs%3Fstatus%3DOPEN%26page%3D2',
    );
  });
});
