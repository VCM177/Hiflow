import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';
import { createFlow, loginAll } from './helpers/flow';

interface Cand {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  source: string;
  hasCv: boolean;
  note: string | null;
  applications: unknown[];
}
interface Page {
  items: Cand[];
  meta: { total: number; totalPages: number };
}

const PREFIX = 'e2e-cand-';
const PDF = Buffer.from('%PDF-1.4\n% fake cv body for tests\n');

describe('Candidates (e2e)', () => {
  let ctx: E2eContext;
  let recruiter: string;
  let hr: string;
  let manager: string;
  let interviewer: string;
  let uploadRoot: string;
  let seq = 0;

  const cvFiles = async () =>
    existsSync(join(uploadRoot, 'cv')) ? readdir(join(uploadRoot, 'cv')) : [];
  // The key never appears in the API, only in the row.
  const keyOf = async (id: string): Promise<string | null> => {
    const rows: { cv_file_key: string | null }[] = await ctx.dataSource.query(
      `SELECT cv_file_key FROM candidates WHERE id = $1`,
      [id],
    );
    return rows[0]?.cv_file_key ?? null;
  };
  const onDisk = (key: string) => join(uploadRoot, 'cv', basename(key));
  const downloadCv = (id: string, token = recruiter) =>
    request(ctx.server).get(`/candidates/${id}/cv`).set(bearer(token));

  const cleanup = async () => {
    await ctx.dataSource.query(
      `DELETE FROM activity_logs WHERE entity_type = 'Candidate'
         AND entity_id IN (SELECT id::text FROM candidates WHERE email LIKE '${PREFIX}%')`,
    );
    await ctx.dataSource.query(
      `DELETE FROM candidates WHERE email LIKE '${PREFIX}%'`,
    );
  };

  const make = async (label = 'x', extra: object = {}): Promise<Cand> =>
    (
      await request(ctx.server)
        .post('/candidates')
        .set(bearer(recruiter))
        .send({
          fullName: `Ứng viên ${label}`,
          email: `${PREFIX}${label}-${++seq}@example.com`,
          ...extra,
        })
        .expect(201)
    ).body as Cand;

  const upload = (
    id: string,
    file: Buffer | null,
    filename = 'cv.pdf',
    token = recruiter,
  ) => {
    const req = request(ctx.server)
      .post(`/candidates/${id}/cv`)
      .set(bearer(token));
    return file ? req.attach('file', file, { filename }) : req;
  };

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-cand-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    recruiter = await loginAs(ctx.server, 'recruiter@hiflow.local');
    hr = await loginAs(ctx.server, 'hr@hiflow.local');
    manager = await loginAs(ctx.server, 'manager@hiflow.local');
    interviewer = await loginAs(ctx.server, 'interviewer@hiflow.local');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  describe('access', () => {
    it('requires authentication', () => {
      return request(ctx.server).get('/candidates').expect(401);
    });

    it('forbids a role with no candidate permissions (department manager)', () => {
      return request(ctx.server)
        .get('/candidates')
        .set(bearer(manager))
        .expect(403);
    });

    it('lets HR read but not create', async () => {
      await request(ctx.server).get('/candidates').set(bearer(hr)).expect(200);
      await request(ctx.server)
        .post('/candidates')
        .set(bearer(hr))
        .send({ fullName: 'X', email: `${PREFIX}hr@example.com` })
        .expect(403);
    });

    it('shows an interviewer only candidates they are scheduled to interview', async () => {
      const created = await make('hidden');

      const list = (
        await request(ctx.server)
          .get(`/candidates?search=${PREFIX}`)
          .set(bearer(interviewer))
          .expect(200)
      ).body as Page;
      expect(list.items.map((c) => c.id)).not.toContain(created.id);

      await request(ctx.server)
        .get(`/candidates/${created.id}`)
        .set(bearer(interviewer))
        .expect(404);
    });
  });

  describe('creating', () => {
    it('creates a candidate with sensible defaults and no applications yet', async () => {
      const c = await make('basic');

      expect(c.source).toBe('OTHER');
      expect(c.hasCv).toBe(false);
      expect(c.note).toBeNull();
      expect(c.applications).toEqual([]);
    });

    it('normalises the email and phone number', async () => {
      const c = await make('normalise', {
        email: `  ${PREFIX}UPPER-${++seq}@Example.COM `,
        phone: '090 123-4567',
        source: 'REFERRAL',
        dob: '1995-06-15',
      });

      expect(c.email).toBe(c.email.toLowerCase());
      expect(c.email.startsWith(PREFIX)).toBe(true);
      expect(c.phone).toBe('0901234567');
      expect(c.source).toBe('REFERRAL');
      expect(c.dob).toBe('1995-06-15');
    });

    it('rejects a duplicate email regardless of case', async () => {
      const first = await make('dup');
      const response = await request(ctx.server)
        .post('/candidates')
        .set(bearer(recruiter))
        .send({ fullName: 'Someone', email: first.email.toUpperCase() })
        .expect(409);

      expect((response.body as { message: string }).message).toMatch(/Email/);
    });

    it.each([
      ['a blank name', { fullName: '   ' }],
      ['a malformed email', { email: 'not-an-email' }],
      ['a malformed phone', { phone: '12345' }],
      ['a letters-only phone', { phone: 'abcdefghij' }],
      ['an unknown source', { source: 'CARRIER_PIGEON' }],
      ['an unexpected field', { cvFileKey: 'cv/evil.pdf' }],
      ['a malformed date of birth', { dob: 'yesterday' }],
    ])('rejects %s', async (_label, override) => {
      await request(ctx.server)
        .post('/candidates')
        .set(bearer(recruiter))
        .send({
          fullName: 'Valid',
          email: `${PREFIX}v-${++seq}@example.com`,
          ...override,
        })
        .expect(400);
    });

    it('rejects a date of birth in the future or under the minimum age', async () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setUTCFullYear(tenYearsAgo.getUTCFullYear() - 10);

      for (const dob of [
        '2999-01-01',
        tenYearsAgo.toISOString().slice(0, 10),
      ]) {
        await request(ctx.server)
          .post('/candidates')
          .set(bearer(recruiter))
          .send({
            fullName: 'Young',
            email: `${PREFIX}y-${++seq}@example.com`,
            dob,
          })
          .expect(400);
      }
    });
  });

  describe('updating and notes', () => {
    it('updates only the supplied fields', async () => {
      const c = await make('edit', { phone: '0901234567' });

      const updated = (
        await request(ctx.server)
          .patch(`/candidates/${c.id}`)
          .set(bearer(recruiter))
          .send({ fullName: 'Tên mới', source: 'AGENCY' })
          .expect(200)
      ).body as Cand;

      expect(updated).toMatchObject({
        fullName: 'Tên mới',
        source: 'AGENCY',
        phone: '0901234567',
      });
    });

    it('refuses to change the email to one already in use', async () => {
      const a = await make('a');
      const b = await make('b');

      await request(ctx.server)
        .patch(`/candidates/${b.id}`)
        .set(bearer(recruiter))
        .send({ email: a.email })
        .expect(409);
    });

    it('cannot change the note through the general update', async () => {
      const c = await make('notefield');

      await request(ctx.server)
        .patch(`/candidates/${c.id}`)
        .set(bearer(recruiter))
        .send({ note: 'sneaky' })
        .expect(400);
    });

    it('sets, replaces and clears the note through its own endpoint', async () => {
      const c = await make('note');
      const put = (note: string, token = recruiter) =>
        request(ctx.server)
          .put(`/candidates/${c.id}/note`)
          .set(bearer(token))
          .send({ note });

      expect(
        ((await put('Liên hệ lại sau').expect(200)).body as Cand).note,
      ).toBe('Liên hệ lại sau');
      expect(((await put('  Đã gọi  ').expect(200)).body as Cand).note).toBe(
        'Đã gọi',
      );
      expect(((await put('').expect(200)).body as Cand).note).toBeNull();

      await put('x'.repeat(2001)).expect(400);
      await put('HR cannot', hr).expect(403);
    });

    it('answers 404 for an unknown candidate and 400 for a malformed id', async () => {
      await request(ctx.server)
        .patch('/candidates/00000000-0000-4000-8000-000000000000')
        .set(bearer(recruiter))
        .send({ fullName: 'x' })
        .expect(404);
      await request(ctx.server)
        .get('/candidates/nope')
        .set(bearer(recruiter))
        .expect(400);
    });
  });

  describe('listing', () => {
    beforeAll(async () => {
      await make('zeta', {
        fullName: 'Zeta Listing',
        phone: '0911111111',
        source: 'SOCIAL',
      });
      await make('alpha', {
        fullName: 'Alpha Listing',
        phone: '0922222222',
        source: 'SOCIAL',
      });
      await make('mid', {
        fullName: 'Mid Listing',
        phone: '0933333333',
        source: 'WEBSITE',
      });
    });

    it('searches by name, email or phone', async () => {
      const get = async (q: string) =>
        (
          (
            await request(ctx.server)
              .get(`/candidates?search=${encodeURIComponent(q)}`)
              .set(bearer(recruiter))
              .expect(200)
          ).body as Page
        ).items;

      expect((await get('Alpha Listing')).map((c) => c.fullName)).toEqual([
        'Alpha Listing',
      ]);
      expect((await get('0933333333')).map((c) => c.fullName)).toEqual([
        'Mid Listing',
      ]);
      expect((await get(`${PREFIX}zeta`)).map((c) => c.fullName)).toEqual([
        'Zeta Listing',
      ]);
    });

    it('filters by source, sorts and paginates', async () => {
      const first = (
        await request(ctx.server)
          .get(
            `/candidates?search=Listing&source=SOCIAL&limit=1&page=1&sortBy=fullName&sortDir=asc`,
          )
          .set(bearer(recruiter))
          .expect(200)
      ).body as Page;

      expect(first.items.map((c) => c.fullName)).toEqual(['Alpha Listing']);
      expect(first.meta).toMatchObject({ total: 2, totalPages: 2 });
    });

    it('rejects bad query values', async () => {
      for (const q of [
        'source=NOPE',
        'sortBy=cvFileKey',
        'createdFrom=yesterday',
        'limit=999',
      ]) {
        await request(ctx.server)
          .get(`/candidates?${q}`)
          .set(bearer(recruiter))
          .expect(400);
      }
    });
  });

  describe('CV upload', () => {
    it('stores a valid PDF privately: the view only says there is one, the key stays in the row', async () => {
      const c = await make('cv');
      const updated = (await upload(c.id, PDF).expect(200)).body as Cand;

      expect(updated.hasCv).toBe(true);
      expect(JSON.stringify(updated)).not.toContain('cv/');
      const key = await keyOf(c.id);
      expect(key).toMatch(/^cv\/[0-9a-f-]{36}\.pdf$/);
      expect(existsSync(onDisk(key!))).toBe(true);
    });

    it('is not served from any public path', async () => {
      const c = await make('nopublic');
      await upload(c.id, PDF).expect(200);
      const key = (await keyOf(c.id))!;

      await request(ctx.server).get(`/uploads/${key}`).expect(404);
      await request(ctx.server).get(`/${key}`).expect(404);
    });

    it('downloads through the authenticated endpoint as a non-sniffable attachment', async () => {
      const c = await make('dl');
      await upload(c.id, PDF).expect(200);

      const download = await downloadCv(c.id).expect(200);

      expect(download.headers['content-type']).toContain('application/pdf');
      expect(download.headers['content-disposition']).toBe(
        `attachment; filename="CV-${c.id}.pdf"`,
      );
      expect(download.headers['x-content-type-options']).toBe('nosniff');
      expect(download.headers['cache-control']).toBe('private, no-store');
      expect(Buffer.from(download.body as Buffer).toString()).toContain(
        'fake cv body',
      );
    });

    it('needs a login to download, and answers 404 when there is no CV', async () => {
      const c = await make('dlauth');

      await request(ctx.server).get(`/candidates/${c.id}/cv`).expect(401);
      await downloadCv(c.id).expect(404);
    });

    it('lets a role with candidate access download, and refuses one without (department manager)', async () => {
      const c = await make('dlperm');
      await upload(c.id, PDF).expect(200);

      await downloadCv(c.id, hr).expect(200);
      await downloadCv(c.id, manager).expect(403);
    });

    it('scopes an interviewer to the candidates they interview', async () => {
      const flow = createFlow(ctx, await loginAll(ctx), 'E2E-cvscope');

      try {
        const jobId = await flow.openJob();
        const scheduled = await flow.candidate('scheduled');
        const stranger = await flow.candidate('stranger');
        await upload(scheduled.id, PDF).expect(200);
        await upload(stranger.id, PDF).expect(200);

        const appId = await flow.application(jobId, scheduled.id);
        await flow.move(appId, 'SCREENING').expect(200);
        await flow.move(appId, 'INTERVIEW').expect(200);
        await flow.scheduleInterview(appId);

        await downloadCv(scheduled.id, interviewer).expect(200);
        await downloadCv(stranger.id, interviewer).expect(404);
      } finally {
        await flow.cleanup();
      }
    });

    it('replaces the previous CV and deletes the old file', async () => {
      const c = await make('replace');
      await upload(c.id, PDF).expect(200);
      const first = (await keyOf(c.id))!;
      await upload(c.id, PDF).expect(200);
      const second = (await keyOf(c.id))!;

      expect(second).not.toBe(first);
      expect(existsSync(onDisk(first))).toBe(false);
      expect(existsSync(onDisk(second))).toBe(true);
    });

    it.each([
      ['a non-document extension', Buffer.from('%PDF-1.4'), 'run.exe'],
      [
        'a script renamed to .pdf',
        Buffer.from('#!/bin/sh\nrm -rf /'),
        'cv.pdf',
      ],
      [
        'a Windows executable renamed to .pdf',
        Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]),
        'cv.pdf',
      ],
      [
        'a Windows executable renamed to .docx',
        Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]),
        'cv.docx',
      ],
      [
        'a legacy .doc',
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]),
        'cv.doc',
      ],
      ['a PDF renamed to .docx', PDF, 'cv.docx'],
      ['an empty file', Buffer.alloc(0), 'cv.pdf'],
    ])('rejects %s and changes nothing', async (_label, content, filename) => {
      const c = await make('badcv');
      const before = (await cvFiles()).length;

      await upload(c.id, content, filename).expect(400);

      expect((await cvFiles()).length).toBe(before);
      const after = (
        await request(ctx.server)
          .get(`/candidates/${c.id}`)
          .set(bearer(recruiter))
          .expect(200)
      ).body as Cand;
      expect(after.hasCv).toBe(false);
    });

    it('rejects a file over 5MB with 413', async () => {
      const c = await make('big');
      const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);

      await upload(c.id, big).expect(413);
    });

    it('rejects a request with no file', async () => {
      const c = await make('nofile');
      await upload(c.id, null).expect(400);
    });

    it('is forbidden without cv-manage permission and stores nothing', async () => {
      const c = await make('perm');
      const before = (await cvFiles()).length;

      await upload(c.id, PDF, 'cv.pdf', hr).expect(403);

      expect((await cvFiles()).length).toBe(before);
    });

    it('does not accept a CV for a candidate that does not exist', async () => {
      const before = (await cvFiles()).length;

      await upload('00000000-0000-4000-8000-000000000000', PDF).expect(404);

      expect((await cvFiles()).length).toBe(before);
    });

    it('removes the CV file and clears the link', async () => {
      const c = await make('rm');
      await upload(c.id, PDF).expect(200);
      const key = (await keyOf(c.id))!;

      const cleared = (
        await request(ctx.server)
          .delete(`/candidates/${c.id}/cv`)
          .set(bearer(recruiter))
          .expect(200)
      ).body as Cand;

      expect(cleared.hasCv).toBe(false);
      expect(existsSync(onDisk(key))).toBe(false);
      await downloadCv(c.id).expect(404);
      await request(ctx.server)
        .delete(`/candidates/${c.id}/cv`)
        .set(bearer(recruiter))
        .expect(404);
    });
  });

  describe('deleting', () => {
    it('deletes the candidate and their CV file', async () => {
      const c = await make('del');
      await upload(c.id, PDF).expect(200);
      const key = (await keyOf(c.id))!;

      await request(ctx.server)
        .delete(`/candidates/${c.id}`)
        .set(bearer(recruiter))
        .expect(204);

      await request(ctx.server)
        .get(`/candidates/${c.id}`)
        .set(bearer(recruiter))
        .expect(404);
      expect(existsSync(onDisk(key))).toBe(false);
    });

    it('404s for an unknown candidate', () => {
      return request(ctx.server)
        .delete('/candidates/00000000-0000-4000-8000-000000000000')
        .set(bearer(recruiter))
        .expect(404);
    });
  });
});
