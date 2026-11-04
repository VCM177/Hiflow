import type { Jsonified } from '@hiflow/shared-types';
import { describe, expect, expectTypeOf, it } from 'vitest';

interface Sample {
  id: string;
  at: Date;
  maybeAt: Date | null;
  count: number;
  tags: readonly string[];
  nested: { when: Date; list: { when: Date }[] };
  status: 'A' | 'B';
}

describe('Jsonified', () => {
  it('turns every Date into a string, including nullable and nested ones', () => {
    expectTypeOf<Jsonified<Sample>['at']>().toEqualTypeOf<string>();
    expectTypeOf<Jsonified<Sample>['maybeAt']>().toEqualTypeOf<string | null>();
    expectTypeOf<Jsonified<Sample>['nested']['when']>().toEqualTypeOf<string>();
    expectTypeOf<
      Jsonified<Sample>['nested']['list'][number]['when']
    >().toEqualTypeOf<string>();
  });

  it('leaves everything that is not a Date as it was', () => {
    expectTypeOf<Jsonified<Sample>['id']>().toEqualTypeOf<string>();
    expectTypeOf<Jsonified<Sample>['count']>().toEqualTypeOf<number>();
    expectTypeOf<Jsonified<Sample>['status']>().toEqualTypeOf<'A' | 'B'>();
    expectTypeOf<Jsonified<Sample>['tags']>().toEqualTypeOf<
      readonly string[]
    >();
  });

  it('describes a real JSON round trip', () => {
    const sample: Sample = {
      id: 'x',
      at: new Date('2026-11-04T00:00:00.000Z'),
      maybeAt: null,
      count: 1,
      tags: ['a'],
      nested: { when: new Date('2026-11-05T00:00:00.000Z'), list: [] },
      status: 'A',
    };
    const wire = JSON.parse(JSON.stringify(sample)) as Jsonified<Sample>;
    expect(wire.at).toBe('2026-11-04T00:00:00.000Z');
    expect(wire.maybeAt).toBeNull();
    expect(wire.nested.when).toBe('2026-11-05T00:00:00.000Z');
  });
});
