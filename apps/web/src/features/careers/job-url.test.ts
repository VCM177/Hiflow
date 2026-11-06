import { describe, expect, it } from 'vitest';

import { jobPath, jobSlugId, parseJobId, slugify } from './job-url';

const ID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

describe('slugify', () => {
  it('drops Vietnamese diacritics and the letter đ', () => {
    expect(slugify('Lập trình viên Đồ họa')).toBe('lap-trinh-vien-do-hoa');
  });
  it('collapses punctuation', () => {
    expect(slugify('  C++ / .NET  Dev!! ')).toBe('c-net-dev');
  });
  it('returns an empty string for a title with no letters', () => {
    expect(slugify('!!!')).toBe('');
  });
  it('limits the length without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} bbb`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('parseJobId', () => {
  it('reads the id after the slug', () => {
    expect(parseJobId(`ke-toan-${ID}`)).toBe(ID);
  });
  it('reads a bare id', () => {
    expect(parseJobId(ID)).toBe(ID);
  });
  it('lower-cases the id', () => {
    expect(parseJobId(ID.toUpperCase())).toBe(ID);
  });
  it('returns null without an id', () => {
    expect(parseJobId('ke-toan')).toBeNull();
    expect(parseJobId(`${ID}-extra`)).toBeNull();
  });
});

describe('jobSlugId and jobPath', () => {
  it('joins slug and id', () => {
    expect(jobSlugId({ id: ID, title: 'Kế toán' })).toBe(`ke-toan-${ID}`);
    expect(jobPath({ id: ID, title: 'Kế toán' })).toBe(
      `/careers/ke-toan-${ID}`,
    );
  });
  it('falls back to the id', () => {
    expect(jobSlugId({ id: ID, title: '!!!' })).toBe(ID);
  });
});
