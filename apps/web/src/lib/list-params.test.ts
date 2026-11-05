import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  DEFAULT_LIMIT,
  listBaseShape,
  MAX_LIMIT,
  parseListParams,
  serializeListParams,
} from './list-params';

describe('parseListParams with the base shape', () => {
  it('uses the defaults for an empty URL', () => {
    expect(parseListParams({}, listBaseShape)).toEqual({
      page: 1,
      limit: DEFAULT_LIMIT,
      search: '',
      sortBy: undefined,
      sortDir: 'asc',
    });
  });

  it('reads valid values', () => {
    expect(
      parseListParams(
        {
          page: '3',
          limit: '25',
          search: '  kế toán ',
          sortBy: 'name',
          sortDir: 'desc',
        },
        listBaseShape,
      ),
    ).toEqual({
      page: 3,
      limit: 25,
      search: 'kế toán',
      sortBy: 'name',
      sortDir: 'desc',
    });
  });

  it('falls back to the default for a limit above the maximum or a page below 1', () => {
    const parsed = parseListParams(
      { limit: String(MAX_LIMIT + 1), page: '0' },
      listBaseShape,
    );
    expect(parsed.limit).toBe(DEFAULT_LIMIT);
    expect(parsed.page).toBe(1);
  });

  it('drops a bad sort direction without touching the other values', () => {
    const parsed = parseListParams(
      { sortDir: 'sideways', page: '2' },
      listBaseShape,
    );
    expect(parsed.sortDir).toBe('asc');
    expect(parsed.page).toBe(2);
  });
});

describe('parseListParams with a module filter', () => {
  const shape = {
    ...listBaseShape,
    status: z.enum(['new', 'interview']).optional().catch(undefined),
  };

  it('drops an unknown filter value and keeps the rest', () => {
    const parsed = parseListParams({ status: 'hacked', page: '4' }, shape);
    expect(parsed.status).toBeUndefined();
    expect(parsed.page).toBe(4);
  });

  it('keeps a valid filter value', () => {
    expect(parseListParams({ status: 'interview' }, shape).status).toBe(
      'interview',
    );
  });
});

describe('serializeListParams', () => {
  it('leaves out defaults, empty values and undefined', () => {
    const search = serializeListParams(
      { page: 1, limit: 10, search: '', status: undefined, sortDir: 'desc' },
      { page: 1, limit: 10, sortDir: 'asc' },
    );
    expect(search.toString()).toBe('sortDir=desc');
  });

  it('repeats the key for an array', () => {
    expect(
      serializeListParams({ status: ['new', 'interview'] }).toString(),
    ).toBe('status=new&status=interview');
  });
});
