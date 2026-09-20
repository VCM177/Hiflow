import { SelectQueryBuilder } from 'typeorm';
import { containsPattern, paginate, toPaginated } from './paginate';

describe('toPaginated', () => {
  it('computes the page count, with at least one page for an empty result', () => {
    expect(toPaginated([], 0, 1, 10).meta.totalPages).toBe(1);
    expect(toPaginated([1], 25, 1, 10).meta.totalPages).toBe(3);
    expect(toPaginated([1], 30, 1, 10).meta.totalPages).toBe(3);
  });
});

describe('paginate', () => {
  it('skips and takes according to the requested page', async () => {
    const skip = jest.fn().mockReturnThis();
    const take = jest.fn().mockReturnThis();
    const getManyAndCount = jest.fn().mockResolvedValue([['a', 'b'], 42]);
    const qb = {
      skip,
      take,
      getManyAndCount,
    } as unknown as SelectQueryBuilder<{
      id: string;
    }>;

    const result = await paginate(qb, 3, 20);

    expect(skip).toHaveBeenCalledWith(40);
    expect(take).toHaveBeenCalledWith(20);
    expect(result.meta).toEqual({
      page: 3,
      limit: 20,
      total: 42,
      totalPages: 3,
    });
  });
});

describe('containsPattern', () => {
  it('wraps the text for a contains search', () => {
    expect(containsPattern('nguyen')).toBe('%nguyen%');
  });

  it('trims surrounding whitespace', () => {
    expect(containsPattern('  an ')).toBe('%an%');
  });

  it.each([
    ['50%', '%50\\%%'],
    ['a_b', '%a\\_b%'],
    ['back\\slash', '%back\\\\slash%'],
  ])('escapes wildcard characters in %s', (input, expected) => {
    expect(containsPattern(input)).toBe(expected);
  });
});
