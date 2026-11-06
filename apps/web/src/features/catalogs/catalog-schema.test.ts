import { describe, expect, it } from 'vitest';

import { catalogFormSchema } from './catalog-schema';

const messages = (input: unknown) => {
  const result = catalogFormSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.message);
};

describe('catalogFormSchema', () => {
  it('accepts a name and a code, trimming both', () => {
    expect(
      catalogFormSchema.parse({ name: '  Kỹ thuật ', code: ' ENG_1 ' }),
    ).toEqual({ name: 'Kỹ thuật', code: 'ENG_1' });
  });

  it('asks for a name', () => {
    expect(messages({ name: '   ', code: 'ENG' })).toEqual([
      'Vui lòng nhập tên.',
    ]);
  });

  it('refuses a name longer than the API accepts', () => {
    expect(messages({ name: 'a'.repeat(101), code: 'ENG' })).toEqual([
      'Tên tối đa 100 ký tự.',
    ]);
    expect(messages({ name: 'a'.repeat(100), code: 'ENG' })).toEqual([]);
  });

  it.each(['', 'A', 'có dấu', 'a-b', 'x'.repeat(31)])(
    'refuses the code "%s"',
    (code) => {
      expect(messages({ name: 'Kỹ thuật', code })).toEqual([
        'Mã chỉ gồm chữ, số hoặc dấu gạch dưới (2 đến 30 ký tự).',
      ]);
    },
  );
});
