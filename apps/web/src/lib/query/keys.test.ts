import { describe, expect, it } from 'vitest';

import { queryKeys } from './keys';

describe('queryKeys', () => {
  it('puts the entity first and the kind second, so one prefix clears the whole entity', () => {
    const list = queryKeys.list('job', { page: 1 });
    const detail = queryKeys.detail('job', 'abc');
    const options = queryKeys.options('job');
    const root = queryKeys.entity('job');

    expect(list[0]).toBe(root[0]);
    expect(detail[0]).toBe(root[0]);
    expect(options[0]).toBe(root[0]);
    expect(list[1]).toBe('list');
    expect(detail[1]).toBe('detail');
    expect(options[1]).toBe('options');
  });

  it('keeps list keys apart when their params differ', () => {
    expect(queryKeys.list('job', { page: 1 })).not.toEqual(
      queryKeys.list('job', { page: 2 }),
    );
  });

  it('gives an option list with no params a stable empty object', () => {
    expect(queryKeys.options('department')).toEqual([
      'department',
      'options',
      {},
    ]);
  });
});
