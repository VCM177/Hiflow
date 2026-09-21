import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { MailService } from './../src/modules/mail/mail.service';
import { OutboxMailService } from './../src/modules/mail/outbox-mail.service';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { approvedRequisition, idByCode } from './helpers/factories';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';
import { DOCX, PDF, submitForm, VALID_FIELDS } from './helpers/public-apply';

const TAG = 'E2E-pubapply';
const RECEIPT_MESSAGE =
  'Chúng tôi đã nhận được hồ sơ của bạn. Vui lòng kiểm tra email để xem xác nhận.';

interface ApplicationRow {
  id: string;
  status: string;
  assignee_id: string | null;
  cv_file_key: string | null;
  consent_at: Date | null;
}

describe('Public application form (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let outbox: OutboxMailService;
  let uploadRoot: string;
  let seq = 0;

  const email = (label: string) =>
    `${flow.mailPrefix}${label}-${++seq}@example.com`;
  const form = (address: string, extra: Record<string, string> = {}) => ({
    ...VALID_FIELDS,
    email: address,
    ...extra,
  });
  const apply = (
    jobId: string,
    address: string,
    extra: Record<string, string> = {},
  ) => submitForm(ctx.server, jobId, form(address, extra));

  const applicationsOf = (address: string): Promise<ApplicationRow[]> =>
    ctx.dataSource.query(
      `SELECT a.id, a.status, a.assignee_id, a.cv_file_key, a.consent_at
         FROM applications a JOIN candidates c ON c.id = a.candidate_id
        WHERE c.email = $1`,
      [address.toLowerCase()],
    );
  const candidatesOf = (
    address: string,
  ): Promise<
    {
      id: string;
      full_name: string;
      phone: string | null;
      source: string;
      cv_file_key: string | null;
    }[]
  > =>
    ctx.dataSource.query(
      `SELECT id, full_name, phone, source, cv_file_key FROM candidates WHERE email = $1`,
      [address.toLowerCase()],
    );
  const cvFiles = async () =>
    existsSync(join(uploadRoot, 'cv')) ? readdir(join(uploadRoot, 'cv')) : [];
  const mailTo = (address: string) =>
    outbox.sent.filter((message) => message.to === address.toLowerCase());

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-pubapply-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    outbox = ctx.app.get(MailService);
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  beforeEach(() => outbox.clear());

  describe('a first submission', () => {
    it('is accepted without a login and answered with the fixed receipt', async () => {
      const jobId = await flow.openJob();

      const response = await apply(jobId, email('first')).expect(202);

      expect(response.body).toEqual({ message: RECEIPT_MESSAGE });
    });

    it('creates the candidate and an unassigned application in the first stage', async () => {
      const jobId = await flow.openJob();
      const address = email('created');

      await apply(jobId, address).expect(202);

      const candidates = await candidatesOf(address);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({
        full_name: VALID_FIELDS.fullName,
        phone: VALID_FIELDS.phone,
        source: 'WEBSITE',
        cv_file_key: null,
      });
      const [application] = await applicationsOf(address);
      expect(application).toMatchObject({ status: 'NEW', assignee_id: null });
      expect(application.consent_at).not.toBeNull();
    });

    it('keeps the CV on the application, privately, and on disk', async () => {
      const jobId = await flow.openJob();
      const address = email('cv');

      await apply(jobId, address).expect(202);

      const [application] = await applicationsOf(address);
      expect(application.cv_file_key).toMatch(/^cv\/[0-9a-f-]{36}\.pdf$/);
      expect(await cvFiles()).toContain(application.cv_file_key!.split('/')[1]);
    });

    it('accepts a Word document too', async () => {
      const jobId = await flow.openJob();
      const address = email('docx');

      await submitForm(ctx.server, jobId, form(address), {
        content: DOCX,
        filename: 'cv.docx',
      }).expect(202);

      expect((await applicationsOf(address))[0].cv_file_key).toMatch(/\.docx$/);
    });

    it('writes the first history row under the system user, not a person', async () => {
      const jobId = await flow.openJob();
      const address = email('history');

      await apply(jobId, address).expect(202);

      const [application] = await applicationsOf(address);
      const rows: {
        from_status: string | null;
        to_status: string;
        note: string;
        is_system: boolean;
      }[] = await ctx.dataSource.query(
        `SELECT h.from_status, h.to_status, h.note, u.is_system
             FROM application_status_histories h JOIN users u ON u.id = h.changed_by_id
            WHERE h.application_id = $1`,
        [application.id],
      );
      expect(rows).toEqual([
        {
          from_status: null,
          to_status: 'NEW',
          note: 'Ứng viên nộp hồ sơ qua website',
          is_system: true,
        },
      ]);
    });

    it('emails the candidate a confirmation naming the job', async () => {
      const jobId = await flow.openJob();
      const address = email('mail');

      await apply(jobId, address).expect(202);

      const sent = mailTo(address);
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toContain('đã nhận hồ sơ');
      expect(sent[0].text).toContain(VALID_FIELDS.fullName);
    });

    it('normalises the email, so the same address in another case is the same person', async () => {
      const jobId = await flow.openJob();
      const address = email('case');

      await apply(jobId, address.toUpperCase()).expect(202);

      expect(await candidatesOf(address)).toHaveLength(1);
    });
  });

  describe('what staff see', () => {
    it('shows an unassigned new application with the website as its author and a downloadable CV', async () => {
      const jobId = await flow.openJob();
      const address = email('staff');
      await apply(jobId, address).expect(202);
      const [application] = await applicationsOf(address);

      const detail = (
        await request(ctx.server)
          .get(`/applications/${application.id}`)
          .set(bearer(t.recruiter))
          .expect(200)
      ).body as {
        status: string;
        assignee: unknown;
        hasCv: boolean;
        history: { changedBy: { name: string } | null }[];
      };
      expect(detail).toMatchObject({
        status: 'NEW',
        assignee: null,
        hasCv: true,
      });
      expect(detail.history[0].changedBy?.name).toBe('Ứng viên (Website)');

      const download = await request(ctx.server)
        .get(`/applications/${application.id}/cv`)
        .set(bearer(t.recruiter))
        .expect(200);
      expect(Buffer.from(download.body as Buffer).equals(PDF)).toBe(true);
    });

    it('lists the candidate with the website as its source', async () => {
      const jobId = await flow.openJob();
      const address = email('listed');
      await apply(jobId, address).expect(202);

      const page = (
        await request(ctx.server)
          .get(
            `/candidates?search=${encodeURIComponent(address)}&source=WEBSITE`,
          )
          .set(bearer(t.recruiter))
          .expect(200)
      ).body as { items: { email: string }[] };

      expect(page.items.map((c) => c.email)).toEqual([address]);
    });
  });

  describe('applying twice, and the answer that must not change', () => {
    it('answers a repeat exactly like the first time, and creates nothing new', async () => {
      const jobId = await flow.openJob();
      const address = email('repeat');

      const first = await apply(jobId, address).expect(202);
      const filesAfterFirst = (await cvFiles()).length;
      const repeat = await apply(jobId, address).expect(202);

      expect(repeat.body).toEqual(first.body);
      expect(repeat.status).toBe(first.status);
      expect(await applicationsOf(address)).toHaveLength(1);
      expect(await candidatesOf(address)).toHaveLength(1);
      // The second CV was thrown away, not orphaned.
      expect((await cvFiles()).length).toBe(filesAfterFirst);
    });

    it('tells only the mailbox owner that it was a repeat', async () => {
      const jobId = await flow.openJob();
      const address = email('repeatmail');

      await apply(jobId, address).expect(202);
      await apply(jobId, address).expect(202);

      const sent = mailTo(address);
      expect(sent).toHaveLength(2);
      expect(sent[0].subject).toContain('đã nhận hồ sơ');
      expect(sent[1].subject).toContain('đã ứng tuyển');
    });

    it('gives the same answer for an address on file and one that is not', async () => {
      const jobId = await flow.openJob();
      const onFile = await flow.candidate('onfile');
      const stranger = email('stranger');

      const known = await apply(jobId, onFile.email).expect(202);
      const unknown = await apply(jobId, stranger).expect(202);

      expect(known.body).toEqual(unknown.body);
      expect(known.headers['content-type']).toBe(
        unknown.headers['content-type'],
      );
      expect(Object.keys(known.headers).sort()).toEqual(
        Object.keys(unknown.headers).sort(),
      );
    });

    it('lets the same person apply to a different job', async () => {
      const address = email('twojobs');
      await apply(await flow.openJob(), address).expect(202);
      await apply(await flow.openJob(), address).expect(202);

      expect(await applicationsOf(address)).toHaveLength(2);
      expect(await candidatesOf(address)).toHaveLength(1);
    });

    it('survives several identical submissions arriving at once', async () => {
      const jobId = await flow.openJob();
      const address = email('race');

      const responses = await Promise.all(
        [1, 2, 3, 4].map(() => apply(jobId, address)),
      );

      expect(responses.map((r) => r.status)).toEqual([202, 202, 202, 202]);
      expect(await applicationsOf(address)).toHaveLength(1);
      expect(await candidatesOf(address)).toHaveLength(1);
      // One kept CV, three discarded.
      const [application] = await applicationsOf(address);
      const kept = (await cvFiles()).filter((f) =>
        application.cv_file_key?.endsWith(f),
      );
      expect(kept).toHaveLength(1);
    });
  });

  describe('a candidate already on file', () => {
    it('gets a new application but nothing about them is overwritten', async () => {
      const jobId = await flow.openJob();
      const onFile = await flow.candidate('existing', 'Tên Gốc Của Nhân Viên');
      const before = (await candidatesOf(onFile.email))[0];

      await apply(jobId, onFile.email, {
        fullName: 'Tên Người Lạ Nhập',
        phone: '0999999999',
      }).expect(202);

      const after = (await candidatesOf(onFile.email))[0];
      expect(after).toEqual(before);
      expect(after.full_name).toBe('Tên Gốc Của Nhân Viên');
      expect(await applicationsOf(onFile.email)).toHaveLength(1);
    });
  });

  describe('jobs that do not take applications', () => {
    it.each(['draft', 'closed', 'unknown'])(
      'answers 404 for a %s job, and stores nothing',
      async (kind) => {
        const address = email(`job${kind}`);
        const filesBefore = (await cvFiles()).length;
        const jobId =
          kind === 'unknown'
            ? '00000000-0000-4000-8000-000000000000'
            : await (async () => {
                const open = await flow.openJob();
                if (kind === 'closed') {
                  await flow
                    .post(t.recruiter, `/jobs/${open}/stop`)
                    .expect(200);
                  return open;
                }
                return draftJob();
              })();

        await apply(jobId, address).expect(404);

        expect(await candidatesOf(address)).toHaveLength(0);
        expect((await cvFiles()).length).toBe(filesBefore);
        expect(mailTo(address)).toHaveLength(0);
      },
    );

    it('rejects a malformed job id with 400', async () => {
      await apply('not-a-uuid', email('baduuid')).expect(400);
    });

    /** A job that was created from an approved requisition but never published. */
    async function draftJob(): Promise<string> {
      const positionId = await idByCode(ctx.dataSource, 'job_positions', 'DEV');
      const requisition = await approvedRequisition(
        ctx.server,
        { creator: t.manager, approver: t.hr },
        { title: `${TAG} draft req ${++seq}`, positionId, quantity: 2 },
      );
      const job = (
        await request(ctx.server)
          .post('/jobs')
          .set(bearer(t.recruiter))
          .send({ requisitionId: requisition.id, title: `${TAG} draft ${seq}` })
          .expect(201)
      ).body as { id: string };
      return job.id;
    }
  });

  describe('bad input changes nothing', () => {
    const expectNothingStored = async (
      address: string,
      filesBefore: number,
    ) => {
      expect(await candidatesOf(address)).toHaveLength(0);
      expect((await cvFiles()).length).toBe(filesBefore);
      expect(mailTo(address)).toHaveLength(0);
    };

    it.each([
      ['no consent', { consent: 'false' }],
      ['consent left out', { consent: undefined }],
      ['an invalid email', { email: 'not-an-email' }],
      ['a name with a line break', { fullName: 'Ứng\nviên' }],
      ['an invalid phone number', { phone: '123' }],
      ['a field the form does not have', { status: 'HIRED' }],
      ['an attempt to pick the source', { source: 'REFERRAL' }],
    ])('is refused with 400 for %s', async (_label, override) => {
      const jobId = await flow.openJob();
      const address = email('invalid');
      const filesBefore = (await cvFiles()).length;

      await submitForm(ctx.server, jobId, {
        ...form(address),
        ...override,
      }).expect(400);

      await expectNothingStored(address, filesBefore);
    });

    it('is refused when there is no CV', async () => {
      const jobId = await flow.openJob();
      const address = email('nocv');

      await submitForm(ctx.server, jobId, form(address), null).expect(400);

      expect(await candidatesOf(address)).toHaveLength(0);
    });

    it.each([
      [
        'a Windows executable renamed .pdf',
        Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]),
        'cv.pdf',
      ],
      [
        'a Windows executable renamed .docx',
        Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]),
        'cv.docx',
      ],
      ['a script renamed .pdf', Buffer.from('#!/bin/sh\nrm -rf /'), 'cv.pdf'],
      [
        'a legacy .doc',
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]),
        'cv.doc',
      ],
      ['a PDF renamed .docx', PDF, 'cv.docx'],
      ['an empty file', Buffer.alloc(0), 'cv.pdf'],
    ])('refuses %s and stores nothing', async (_label, content, filename) => {
      const jobId = await flow.openJob();
      const address = email('badcv');
      const filesBefore = (await cvFiles()).length;

      await submitForm(ctx.server, jobId, form(address), {
        content,
        filename,
      }).expect(400);

      await expectNothingStored(address, filesBefore);
    });

    it('refuses a file over 5MB with 413, having stored nothing', async () => {
      const jobId = await flow.openJob();
      const address = email('big');
      const filesBefore = (await cvFiles()).length;
      const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);

      await submitForm(ctx.server, jobId, form(address), {
        content: big,
        filename: 'cv.pdf',
      }).expect(413);

      await expectNothingStored(address, filesBefore);
    });

    it('refuses a second file or a file under another field name', async () => {
      const jobId = await flow.openJob();
      const address = email('extrafile');

      await request(ctx.server)
        .post(`/public/jobs/${jobId}/applications`)
        .field('fullName', VALID_FIELDS.fullName)
        .field('email', address)
        .field('phone', VALID_FIELDS.phone)
        .field('consent', 'true')
        .attach('cv', PDF, { filename: 'cv.pdf' })
        .attach('cv', PDF, { filename: 'cv2.pdf' })
        .expect(400);
      await request(ctx.server)
        .post(`/public/jobs/${jobId}/applications`)
        .field('fullName', VALID_FIELDS.fullName)
        .field('email', address)
        .field('phone', VALID_FIELDS.phone)
        .field('consent', 'true')
        .attach('resume', PDF, { filename: 'cv.pdf' })
        .expect(400);

      expect(await candidatesOf(address)).toHaveLength(0);
    });

    it('refuses a JSON body: the form is multipart only', async () => {
      const jobId = await flow.openJob();

      await request(ctx.server)
        .post(`/public/jobs/${jobId}/applications`)
        .send(form(email('json')))
        .expect(400);
    });
  });

  describe('personal data stays out of the activity log', () => {
    it('writes no activity row for a submission', async () => {
      const jobId = await flow.openJob();
      const address = email('nolog');
      const count = async (): Promise<number> => {
        const rows: { n: string }[] = await ctx.dataSource.query(
          `SELECT COUNT(*) AS n FROM activity_logs
            WHERE payload::text LIKE '%' || $1 || '%'
               OR payload->>'route' = '/public/jobs/:id/applications'`,
          [address],
        );
        return Number(rows[0].n);
      };

      await apply(jobId, address).expect(202);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(await count()).toBe(0);
    });
  });
});
