import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { bearer, createE2eApp, E2eContext, loginAs } from './helpers/e2e-app';

interface Cand {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dob: string | null;
  source: string;
  cvFileUrl: string | null;
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
  const onDisk = (url: string) => join(uploadRoot, 'cv', url.split('/').pop()!);

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
      expect(c.cvFileUrl).toBeNull();
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
      ['an unexpected field', { cvFileUrl: '/uploads/cv/evil.pdf' }],
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
        'sortBy=cvFileUrl',
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
    it('stores a valid PDF and serves it back as an attachment', async () => {
      const c = await make('cv');
      const updated = (await upload(c.id, PDF).expect(200)).body as Cand;

      expect(updated.cvFileUrl).toMatch(/^\/uploads\/cv\/[0-9a-f-]{36}\.pdf$/);
      expect(existsSync(onDisk(updated.cvFileUrl!))).toBe(true);

      const download = await request(ctx.server)
        .get(updated.cvFileUrl!)
        .expect(200);
      expect(download.headers['content-disposition']).toBe('attachment');
      expect(download.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.from(download.body as Buffer).toString()).toContain(
        'fake cv body',
      );
    });

    it('replaces the previous CV and deletes the old file', async () => {
      const c = await make('replace');
      const first = (await upload(c.id, PDF).expect(200)).body as Cand;
      const second = (await upload(c.id, PDF).expect(200)).body as Cand;

      expect(second.cvFileUrl).not.toBe(first.cvFileUrl);
      expect(existsSync(onDisk(first.cvFileUrl!))).toBe(false);
      expect(existsSync(onDisk(second.cvFileUrl!))).toBe(true);
    });

    it.each([
      ['a non-document extension', Buffer.from('%PDF-1.4'), 'run.exe'],
      [
        'a script renamed to .pdf',
        Buffer.from('#!/bin/sh\nrm -rf /'),
        'cv.pdf',
      ],
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
      expect(after.cvFileUrl).toBeNull();
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
      const withCv = (await upload(c.id, PDF).expect(200)).body as Cand;

      const cleared = (
        await request(ctx.server)
          .delete(`/candidates/${c.id}/cv`)
          .set(bearer(recruiter))
          .expect(200)
      ).body as Cand;

      expect(cleared.cvFileUrl).toBeNull();
      expect(existsSync(onDisk(withCv.cvFileUrl!))).toBe(false);
      await request(ctx.server).get(withCv.cvFileUrl!).expect(404);
      await request(ctx.server)
        .delete(`/candidates/${c.id}/cv`)
        .set(bearer(recruiter))
        .expect(404);
    });
  });

  describe('deleting', () => {
    it('deletes the candidate and their CV file', async () => {
      const c = await make('del');
      const withCv = (await upload(c.id, PDF).expect(200)).body as Cand;

      await request(ctx.server)
        .delete(`/candidates/${c.id}`)
        .set(bearer(recruiter))
        .expect(204);

      await request(ctx.server)
        .get(`/candidates/${c.id}`)
        .set(bearer(recruiter))
        .expect(404);
      expect(existsSync(onDisk(withCv.cvFileUrl!))).toBe(false);
    });

    it('404s for an unknown candidate', () => {
      return request(ctx.server)
        .delete('/candidates/00000000-0000-4000-8000-000000000000')
        .set(bearer(recruiter))
        .expect(404);
    });
  });
});
