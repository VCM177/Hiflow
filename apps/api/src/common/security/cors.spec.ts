import { parseAllowedOrigins } from './cors';

describe('parseAllowedOrigins', () => {
  it('returns nothing when unset or blank, so no cross-origin access is opened', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('  ')).toEqual([]);
  });

  it('splits a comma-separated list and trims each entry', () => {
    expect(
      parseAllowedOrigins(' https://app.example.com , http://localhost:3000,'),
    ).toEqual(['https://app.example.com', 'http://localhost:3000']);
  });

  it('refuses the wildcard', () => {
    expect(() => parseAllowedOrigins('*')).toThrow('never "*"');
    expect(() => parseAllowedOrigins('https://a.example.com,*')).toThrow(
      'never "*"',
    );
  });

  it.each([
    ['a trailing slash', 'https://app.example.com/'],
    ['a path', 'https://app.example.com/app'],
    ['a non-http scheme', 'ftp://app.example.com'],
    ['a bare host', 'app.example.com'],
  ])('refuses an entry with %s', (_label, value) => {
    expect(() => parseAllowedOrigins(value)).toThrow('WEB_ORIGIN');
  });
});
