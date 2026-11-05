import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('drops falsy values and joins the rest', () => {
    expect(cn('rounded-hf-control', false, null, undefined, 'p-2')).toBe(
      'rounded-hf-control p-2',
    );
  });

  it('lets the later Tailwind utility win a conflict', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
  });

  it('accepts conditional objects', () => {
    expect(cn({ 'font-medium': true, italic: false })).toBe('font-medium');
  });
});
