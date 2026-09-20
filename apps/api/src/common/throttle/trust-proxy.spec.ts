import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('trusts nothing when unset, empty or false', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('turns a number into a hop count', () => {
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy(' 1 ')).toBe(1);
  });

  it('passes an Express preset or subnet through', () => {
    expect(parseTrustProxy('loopback')).toBe('loopback');
  });

  it('refuses "true", which would let clients choose the address they are limited by', () => {
    expect(() => parseTrustProxy('true')).toThrow('spoof');
  });
});
