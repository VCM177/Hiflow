import { describe, expect, it } from 'vitest';

import { loginUrlFor, safeNextPath } from './next-path';

describe('loginUrlFor', () => {
  it('encodes the page the visitor asked for', () => {
    expect(loginUrlFor('/jobs?status=OPEN&page=2')).toBe(
      '/login?next=%2Fjobs%3Fstatus%3DOPEN%26page%3D2',
    );
  });
});

describe('safeNextPath', () => {
  it.each(['/', '/jobs', '/interviews?result=PENDING', '/jobs/12#top'])(
    'accepts the in-app path %s',
    (value) => {
      expect(safeNextPath(value)).toBe(value);
    },
  );

  it.each([
    null,
    undefined,
    '',
    'jobs',
    'https://evil.example/x',
    '//evil.example/x',
    '/\\evil.example',
    '/jobs\n',
    'javascript:alert(1)',
  ])('rejects %s', (value) => {
    expect(safeNextPath(value)).toBeUndefined();
  });
});
