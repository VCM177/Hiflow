import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

type Row = Record<string, string | number>;
interface Report {
  type: string;
  title: string;
  period: { from: string; to: string };
  columns: { key: string; label: string }[];
  rows: Row[];
}

const TAG = 'E2E-RPT';
const FORMULA_TITLE = `=${TAG} formula`;
const day = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

describe('Reports (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let engId: string;
  let qaId: string;
  let salesJob: { id: string; title: string; requisitionCode: string };
  let engJob: { id: string; title: string; requisitionCode: string };
  let sourcesBefore: Report;

  const report = async (
    type: string,
    query = '',
    token = t.hr,
  ): Promise<Report> =>
    (
      await request(ctx.server)
        .get(`/reports/${type}${query}`)
        .set(bearer(token))
        .expect(200)
    ).body as Report;
  const exportCsv = (type: string, query = '', token = t.hr) =>
    request(ctx.server)
      .get(`/reports/${type}/export${query}`)
      .set(bearer(token));

  const candidate = async (source: string, label: string) =>
    (
      await flow
        .post(t.recruiter, '/candidates', {
          fullName: `Ứng viên ${label}`,
          email: `${flow.mailPrefix}${label}@example.com`,
          source,
        })
        .expect(201)
    ).body as { id: string };

  const jobInfo = async (jobId: string) => {
    const job = (
      await request(ctx.server)
        .get(`/jobs/${jobId}`)
        .set(bearer(t.hr))
        .expect(200)
    ).body as { title: string; requisition: { code: string } };
    return {
      id: jobId,
      title: job.title,
      requisitionCode: job.requisition.code,
    };
  };

  /** Takes an application through the whole funnel to HIRED via the real API. */
  const hire = async (jobId: string, candidateId: string) => {
    const appId = await flow.application(jobId, candidateId);
    await flow.move(appId, 'SCREENING').expect(200);
    await flow.move(appId, 'INTERVIEW').expect(200);
    await flow.passInterview(appId);
    await flow.move(appId, 'OFFER').expect(200);
    await flow
      .post(t.recruiter, `/applications/${appId}/offer`, flow.offerBody())
      .expect(201);
    await flow
      .post(t.recruiter, `/applications/${appId}/offer/response`, {
        accepted: true,
      })
      .expect(200);
  };

  const cleanupFormula = async () => {
    await ctx.dataSource.query(
      `DELETE FROM activity_logs WHERE entity_type = 'Requisition'
         AND entity_id IN (SELECT id::text FROM requisitions WHERE title = $1)`,
      [FORMULA_TITLE],
    );
    await ctx.dataSource.query(`DELETE FROM requisitions WHERE title = $1`, [
      FORMULA_TITLE,
    ]);
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    engId = await idByCode(ctx.dataSource, 'departments', 'ENG');
    qaId = await idByCode(ctx.dataSource, 'job_positions', 'QA');
    await flow.cleanup();
    await cleanupFormula();

    sourcesBefore = await report('candidate-sources');

    // Sales / DEV job for 2 people. Four applications, one at each point of the funnel.
    const salesJobId = await flow.openJob({ extra: { quantity: 2 } });
    const [c1, c2, c3, c4] = [
      await candidate('REFERRAL', 'c1'),
      await candidate('REFERRAL', 'c2'),
      await candidate('WEBSITE', 'c3'),
      await candidate('WEBSITE', 'c4'),
    ];
    await flow.application(salesJobId, c1.id); // stays NEW
    const a2 = await flow.application(salesJobId, c2.id);
    await flow.move(a2, 'SCREENING').expect(200); // screened only
    const a3 = await flow.application(salesJobId, c3.id);
    await flow.move(a3, 'SCREENING').expect(200);
    await flow.move(a3, 'INTERVIEW').expect(200);
    await flow.move(a3, 'REJECTED', 'Không đạt phỏng vấn').expect(200);
    await hire(salesJobId, c4.id); // hired

    // Engineering / QA job with a single application from a different source.
    const engJobId = await flow.openJob({
      creator: t.admin,
      extra: { departmentId: engId, positionId: qaId, quantity: 1 },
    });
    await flow.application(engJobId, (await candidate('SOCIAL', 'c5')).id);

    salesJob = await jobInfo(salesJobId);
    engJob = await jobInfo(engJobId);
  });

  afterAll(async () => {
    await flow.cleanup();
    await cleanupFormula();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', async () => {
      await request(ctx.server).get('/reports/job-results').expect(401);
      await request(ctx.server).get('/reports/job-results/export').expect(401);
    });

    it.each(['recruiter', 'manager', 'interviewer'] as const)(
      'forbids %s, who has no report permission, from viewing and exporting',
      async (role) => {
        await request(ctx.server)
          .get('/reports/job-results')
          .set(bearer(t[role]))
          .expect(403);
        await exportCsv('job-results', '', t[role]).expect(403);
      },
    );

    it.each(['hr', 'admin'] as const)(
      'lets %s view and export',
      async (role) => {
        await report('job-results', '', t[role]);
        await exportCsv('job-results', '', t[role]).expect(200);
      },
    );

    it('rejects an unknown report type with a clear message', async () => {
      for (const path of ['/reports/nope', '/reports/nope/export']) {
        const response = await request(ctx.server)
          .get(path)
          .set(bearer(t.hr))
          .expect(400);
        expect((response.body as { message: string }).message).toBe(
          'Loại báo cáo không hợp lệ',
        );
      }
    });
  });

  describe('requisition progress', () => {
    it('shows how far a requisition has been filled', async () => {
      const rows = (await report('requisition-progress')).rows;
      const row = rows.find((r) => r.code === salesJob.requisitionCode)!;

      expect(row).toMatchObject({
        department: 'Kinh doanh',
        position: 'Lập trình viên',
        quantity: 2,
        hired: 1,
        fillRate: 50,
        openJobs: 1,
        status: 'APPROVED',
        statusLabel: 'Đã duyệt',
      });
      expect(typeof row.createdAt).toBe('string');
    });

    it('describes itself: title, period and Vietnamese column labels', async () => {
      const r = await report('requisition-progress');

      expect(r.title).toBe('Báo cáo tiến độ yêu cầu tuyển dụng');
      expect(r.period).toEqual({ from: day(-29), to: day(0) });
      expect(r.columns.map((c) => c.label)).toEqual(
        expect.arrayContaining([
          'Mã yêu cầu',
          'Tỷ lệ lấp đầy (%)',
          'Trạng thái',
        ]),
      );
      expect(r.columns.every((c) => c.key in r.rows[0])).toBe(true);
    });
  });

  describe('job results', () => {
    it('counts each stage an application reached, not only where it is now', async () => {
      const rows = (await report('job-results')).rows;
      const row = rows.find((r) => r.title === salesJob.title)!;

      expect(row).toMatchObject({
        department: 'Kinh doanh',
        position: 'Lập trình viên',
        statusLabel: 'Đang tuyển',
        quantity: 2,
        applications: 4,
        screened: 3,
        interviewed: 2,
        offered: 1,
        hired: 1,
        rejected: 1,
        hireRate: 25,
      });
    });

    it('shows a job with one untouched application', async () => {
      const row = (await report('job-results')).rows.find(
        (r) => r.title === engJob.title,
      )!;

      expect(row).toMatchObject({
        applications: 1,
        screened: 0,
        hired: 0,
        hireRate: 0,
      });
    });
  });

  describe('candidate sources', () => {
    it('adds up applications and hires per source', async () => {
      const after = await report('candidate-sources');
      const pick = (r: Report, label: string) =>
        r.rows.find((row) => row.sourceLabel === label) ?? {
          candidates: 0,
          applications: 0,
          hired: 0,
        };
      const delta = (label: string, key: string) =>
        (pick(after, label)[key] as number) -
        (pick(sourcesBefore, label)[key] as number);

      expect(delta('Giới thiệu', 'candidates')).toBe(2);
      expect(delta('Giới thiệu', 'applications')).toBe(2);
      expect(delta('Giới thiệu', 'hired')).toBe(0);
      expect(delta('Website', 'applications')).toBe(2);
      expect(delta('Website', 'hired')).toBe(1);
      expect(delta('Mạng xã hội', 'applications')).toBe(1);
    });

    it('computes the hire rate from the totals', async () => {
      const rows = (await report('candidate-sources')).rows;

      for (const row of rows) {
        const expected =
          row.applications === 0
            ? 0
            : Math.round(
                ((row.hired as number) / (row.applications as number)) * 1000,
              ) / 10;
        expect(row.hireRate).toBe(expected);
      }
    });
  });

  describe('filters', () => {
    it('narrows by department and by position', async () => {
      for (const query of [`?departmentId=${engId}`, `?positionId=${qaId}`]) {
        const titles = (await report('job-results', query)).rows.map(
          (r) => r.title,
        );

        expect(titles).toContain(engJob.title);
        expect(titles).not.toContain(salesJob.title);
      }

      const reqs = (
        await report('requisition-progress', `?departmentId=${engId}`)
      ).rows;
      expect(reqs.map((r) => r.code)).toContain(engJob.requisitionCode);
      expect(reqs.map((r) => r.code)).not.toContain(salesJob.requisitionCode);
    });

    it('leaves out work outside the requested days', async () => {
      const yesterday = `?from=${day(-1)}&to=${day(-1)}`;

      const reqs = (await report('requisition-progress', yesterday)).rows;
      const jobs = (await report('job-results', yesterday)).rows;

      expect(reqs.map((r) => r.code)).not.toContain(salesJob.requisitionCode);
      expect(jobs.map((r) => r.title)).not.toContain(salesJob.title);
    });

    it.each([
      ['a start after the end', `?from=${day(0)}&to=${day(-3)}`],
      ['a span over a year', `?from=${day(-400)}&to=${day(0)}`],
      ['a malformed date', '?from=soon'],
      ['a malformed department id', '?departmentId=nope'],
      ['an unexpected parameter', '?limit=5'],
    ])('rejects %s', async (_label, query) => {
      await request(ctx.server)
        .get(`/reports/job-results${query}`)
        .set(bearer(t.hr))
        .expect(400);
      await exportCsv('job-results', query).expect(400);
    });
  });

  describe('CSV export', () => {
    it('downloads as an attachment with a descriptive name', async () => {
      const response = await exportCsv('job-results').expect(200);

      expect(response.headers['content-type']).toMatch(/^text\/csv/);
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="job-results_${day(-29)}_${day(0)}.csv"`,
      );
    });

    it('starts with a BOM and Vietnamese headers, and carries the same rows as the report', async () => {
      const csv = (await exportCsv('job-results').expect(200)).text;
      const json = await report('job-results');
      const lines = csv.trim().split('\r\n');

      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(lines[0].replace('﻿', '')).toBe(
        json.columns.map((c) => c.label).join(','),
      );
      expect(lines).toHaveLength(json.rows.length + 1);
      expect(csv).toContain(salesJob.title);
    });

    it('exports each report type', async () => {
      for (const type of [
        'requisition-progress',
        'job-results',
        'candidate-sources',
      ]) {
        expect((await exportCsv(type).expect(200)).text.length).toBeGreaterThan(
          20,
        );
      }
    });

    it('defuses spreadsheet formulas typed into a title', async () => {
      const devId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
      await flow
        .post(t.manager, '/requisitions', {
          title: FORMULA_TITLE,
          positionId: devId,
          quantity: 1,
        })
        .expect(201);

      const csv = (await exportCsv('requisition-progress').expect(200)).text;

      expect(csv).toContain(`,'${FORMULA_TITLE},`);
      expect(csv).not.toContain(`,${FORMULA_TITLE},`);
    });
  });
});
