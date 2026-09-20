import { sanitizePayload } from './sanitize-payload';

describe('sanitizePayload', () => {
  it('keeps ordinary fields untouched', () => {
    const body = { title: 'Backend developer', quantity: 2, urgent: false };

    expect(sanitizePayload(body)).toEqual(body);
  });

  it.each([
    'password',
    'newPassword',
    'accessToken',
    'JWT_SECRET',
    'Authorization',
  ])('redacts the %s field', (key) => {
    expect(sanitizePayload({ [key]: 'hunter2' })).toEqual({
      [key]: '[REDACTED]',
    });
  });

  it('redacts credentials nested inside objects and arrays', () => {
    const result = sanitizePayload({
      user: { email: 'a@hiflow.local', password: 'hunter2' },
      steps: [{ token: 'abc' }, { name: 'ok' }],
    });

    expect(result).toEqual({
      user: { email: 'a@hiflow.local', password: '[REDACTED]' },
      steps: [{ token: '[REDACTED]' }, { name: 'ok' }],
    });
  });

  it('truncates structures nested deeper than the limit', () => {
    const deep = { a: { b: { c: { d: { e: 'too deep' } } } } };

    expect(JSON.stringify(sanitizePayload(deep))).toContain('[TRUNCATED]');
    expect(JSON.stringify(sanitizePayload(deep))).not.toContain('too deep');
  });

  it('passes primitives and null through', () => {
    expect(sanitizePayload('text')).toBe('text');
    expect(sanitizePayload(5)).toBe(5);
    expect(sanitizePayload(null)).toBeNull();
    expect(sanitizePayload(undefined)).toBeUndefined();
  });
});
