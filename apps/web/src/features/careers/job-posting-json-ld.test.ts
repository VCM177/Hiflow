import { describe, expect, it } from 'vitest';

import type { PublicJob } from '@/server/public-jobs';

import { jobPostingJsonLd, serializeJsonLd } from './job-posting-json-ld';

const job: PublicJob = {
  id: 'id',
  title: 'Kế toán',
  department: 'Tài chính',
  position: null,
  location: 'Hà Nội',
  description: '<p>Mô tả</p><script>x</script>',
  quantity: 1,
  salaryMin: 10_000_000,
  salaryMax: null,
  publishedAt: '2026-11-01T00:00:00.000Z',
};

describe('jobPostingJsonLd', () => {
  it('describes the job with a sanitised description', () => {
    const data = jobPostingJsonLd(job, 'https://example.com/careers/x');
    expect(data['@type']).toBe('JobPosting');
    expect(data.description).toBe('<p>Mô tả</p>');
    expect(data.baseSalary?.value.minValue).toBe(10_000_000);
    expect(data.baseSalary?.value.maxValue).toBeUndefined();
  });

  it('leaves out salary and place when unknown', () => {
    const data = jobPostingJsonLd(
      { ...job, salaryMin: null, location: null },
      'u',
    );
    expect(data.baseSalary).toBeUndefined();
    expect(data.jobLocation).toBeUndefined();
  });
});

describe('serializeJsonLd', () => {
  it('cannot close the script tag', () => {
    expect(serializeJsonLd({ a: '</script><b>' })).not.toContain('<');
  });
});
