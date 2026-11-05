import { describe, expect, it } from 'vitest';

import { buildQueryString } from './query-string';

describe('buildQueryString', () => {
  it('returns an empty string when there is nothing to send', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('drops null, undefined, empty strings and empty arrays', () => {
    expect(
      buildQueryString({
        search: '',
        status: null,
        department: undefined,
        ids: [],
        page: 2,
      }),
    ).toBe('?page=2');
  });

  it('keeps zero and false, which are real values', () => {
    expect(buildQueryString({ page: 0, active: false })).toBe(
      '?page=0&active=false',
    );
  });

  it('repeats the key for each array item, in order', () => {
    expect(buildQueryString({ status: ['new', 'interview'] })).toBe(
      '?status=new&status=interview',
    );
  });

  it('encodes user text so it cannot change the query', () => {
    expect(buildQueryString({ search: 'a&b=c' })).toBe('?search=a%26b%3Dc');
  });
});
