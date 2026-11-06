import { describe, expect, it } from 'vitest';

import { funnelRows } from './funnel';

const stage = (name: string, count: number) => ({
  stage: name,
  label: name,
  count,
});

describe('funnelRows', () => {
  it('scales bars to the widest stage and takes percentages from the first', () => {
    const rows = funnelRows([
      stage('A', 40),
      stage('B', 20),
      stage('C', 10),
    ] as never);
    expect(rows.map((r) => r.width)).toEqual([100, 50, 25]);
    expect(rows.map((r) => r.percentOfFirst)).toEqual([100, 50, 25]);
  });

  it('does not divide by zero on an empty funnel', () => {
    const rows = funnelRows([stage('A', 0), stage('B', 0)] as never);
    expect(rows.map((r) => r.width)).toEqual([0, 0]);
    expect(rows.map((r) => r.percentOfFirst)).toEqual([null, null]);
  });

  it('rounds the percentage', () => {
    expect(
      funnelRows([stage('A', 3), stage('B', 1)] as never)[1].percentOfFirst,
    ).toBe(33);
  });

  it('returns nothing for nothing', () => {
    expect(funnelRows([])).toEqual([]);
  });
});
