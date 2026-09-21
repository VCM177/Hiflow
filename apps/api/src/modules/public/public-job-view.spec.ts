import { JobStatus } from '@hiflow/shared-types';
import { Job } from '../jobs/entities/job.entity';
import { toPublicJobView } from './public-job-view';

const job = {
  id: 'job-1',
  requisitionId: 'req-secret',
  requisition: { id: 'req-secret', code: 'REQ-0001', budgetMax: 99 },
  title: 'Lập trình viên',
  positionId: 'pos-1',
  position: { id: 'pos-1', name: 'Developer', code: 'DEV' },
  departmentId: 'dep-1',
  department: { id: 'dep-1', name: 'Kỹ thuật', code: 'ENG' },
  quantity: 3,
  salaryMin: 15_000_000,
  salaryMax: 25_000_000,
  location: 'Hà Nội',
  description: '<p>Mô tả</p>',
  status: JobStatus.OPEN,
  publishedAt: new Date('2026-09-01T00:00:00Z'),
  createdById: 'user-secret',
  createdBy: { id: 'user-secret', fullName: 'Người tạo', email: 'a@b.c' },
  createdAt: new Date('2026-08-30T00:00:00Z'),
  updatedAt: new Date('2026-09-02T00:00:00Z'),
} as unknown as Job;

describe('toPublicJobView', () => {
  it('exposes exactly the fields written for candidates', () => {
    expect(Object.keys(toPublicJobView(job)).sort()).toEqual([
      'department',
      'description',
      'id',
      'location',
      'position',
      'publishedAt',
      'quantity',
      'salaryMax',
      'salaryMin',
      'title',
    ]);
  });

  it('shows names, never internal ids, codes, creators or status', () => {
    const json = JSON.stringify(toPublicJobView(job));

    for (const secret of [
      'req-secret',
      'REQ-0001',
      'user-secret',
      'Người tạo',
      'a@b.c',
      'pos-1',
      'dep-1',
      'ENG',
      'OPEN',
    ]) {
      expect(json).not.toContain(secret);
    }
    expect(toPublicJobView(job)).toMatchObject({
      department: 'Kỹ thuật',
      position: 'Developer',
      salaryMin: 15_000_000,
      salaryMax: 25_000_000,
    });
  });

  it('copes with a job whose relations were not loaded', () => {
    const bare = { ...job, department: undefined, position: undefined } as Job;

    expect(toPublicJobView(bare)).toMatchObject({
      department: null,
      position: null,
    });
  });
});
