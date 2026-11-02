import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { StorageService } from './../src/modules/storage/storage.service';
import { auditEvents, AuditEventRow, rowChanges } from './helpers/audit';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

const TAG = 'E2E-AUDAPP';
const PDF = Buffer.from('%PDF-1.4\n% cv for the audit trail\n');

describe('Audit trail: applications and offers (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;
  let uploadRoot: string;
  let recruiterId: string;
  let hrId: string;

  const idOf = async (email: string) =>
    (
      await ctx.maintenance.query<{ id: string }[]>(
        `SELECT id FROM users WHERE email = $1`,
        [email],
      )
    )[0].id;
  const trail = (id: string): Promise<AuditEventRow[]> =>
    auditEvents(ctx, { entityId: id });
  const names = async (id: string) => (await trail(id)).map((e) => e.event);

  beforeAll(async () => {
    uploadRoot = await mkdtemp(join(tmpdir(), 'hiflow-audapp-'));
    process.env.UPLOAD_DIR = uploadRoot;

    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, TAG);
    recruiterId = await idOf('recruiter@hiflow.local');
    hrId = await idOf('hr@hiflow.local');
    await flow.cleanup();
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
    delete process.env.UPLOAD_DIR;
    await rm(uploadRoot, { recursive: true, force: true });
  });

  describe('applications', () => {
    it('records the creation by the recruiter, with the application and its first history row', async () => {
      const appId = await flow.application(jobId);

      const [event] = await trail(appId);
      expect(event).toMatchObject({
        event: 'APPLICATION_CREATED',
        entity_type: 'Application',
        actor_id: recruiterId,
        actor_role: 'RECRUITER',
      });
      const changes = await rowChanges(ctx, event);
      expect(changes.map((c) => c.table_name).sort()).toEqual([
        'application_status_histories',
        'applications',
      ]);
    });

    it('records every move with where it came from and why, tied to the status row', async () => {
      const appId = await flow.application(jobId);

      await flow.move(appId, 'SCREENING').expect(200);
      await flow.move(appId, 'REJECTED', 'Không phù hợp').expect(200);

      const moves = (await trail(appId)).filter(
        (e) => e.event === 'APPLICATION_STATUS_CHANGED',
      );
      expect(moves.map((m) => m.data)).toEqual([
        { from: 'NEW', to: 'SCREENING', note: null },
        { from: 'SCREENING', to: 'REJECTED', note: 'Không phù hợp' },
      ]);
      const changes = await rowChanges(ctx, moves[1]);
      expect(
        changes.find((c) => c.table_name === 'applications')?.changes,
      ).toEqual({ status: ['SCREENING', 'REJECTED'] });
    });

    it('records nothing for a move that was refused or that lost a race', async () => {
      const appId = await flow.application(jobId);
      const before = (await trail(appId)).length;

      await flow.move(appId, 'HIRED').expect(409);
      await flow.move(appId, 'REJECTED').expect(400);
      const results = await Promise.all([
        flow.move(appId, 'SCREENING'),
        flow.move(appId, 'SCREENING', undefined, t.admin),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await trail(appId)).length).toBe(before + 1);
    });

    it('records an assignment change with who it came from and went to, once', async () => {
      const appId = await flow.application(jobId);
      const patch = (assigneeId: string | null) =>
        request(ctx.server)
          .patch(`/applications/${appId}/assignee`)
          .set(bearer(t.recruiter))
          .send({ assigneeId });

      await patch(hrId).expect(200);
      await patch(hrId).expect(200);
      await patch(null).expect(200);

      const events = (await trail(appId)).filter(
        (e) => e.event === 'APPLICATION_ASSIGNEE_CHANGED',
      );
      expect(events.map((e) => e.data)).toEqual([
        { from: recruiterId, to: hrId },
        { from: hrId, to: null },
      ]);
    });

    it('records a note change without the note, and a delete of a new application', async () => {
      const appId = await flow.application(jobId);

      await request(ctx.server)
        .put(`/applications/${appId}/note`)
        .set(bearer(t.recruiter))
        .send({ note: 'Ghi chú riêng tư' })
        .expect(200);
      await request(ctx.server)
        .delete(`/applications/${appId}`)
        .set(bearer(t.recruiter))
        .expect(204);

      const events = await trail(appId);
      expect(events.map((e) => e.event)).toEqual([
        'APPLICATION_CREATED',
        'APPLICATION_NOTE_UPDATED',
        'APPLICATION_DELETED',
      ]);
      expect(JSON.stringify(events)).not.toContain('riêng tư');
      // Deleting it also removed its history, and the trigger saw that too.
      const deleted = await rowChanges(ctx, events[2]);
      expect(deleted.map((c) => `${c.table_name}:${c.op}`).sort()).toEqual([
        'application_status_histories:D',
        'applications:D',
      ]);
    });

    it('records each download of the CV a candidate sent with the application', async () => {
      const appId = await flow.application(jobId);
      const { key } = await ctx.app.get(StorageService).upload({
        originalname: 'cv.pdf',
        mimetype: 'application/pdf',
        size: PDF.length,
        buffer: PDF,
      });
      await ctx.maintenance.query(
        `UPDATE applications SET cv_file_key = $1 WHERE id = $2`,
        [key, appId],
      );

      await request(ctx.server)
        .get(`/applications/${appId}/cv`)
        .set(bearer(t.hr))
        .expect(200);

      const [download] = (await trail(appId)).filter(
        (e) => e.event === 'APPLICATION_CV_DOWNLOADED',
      );
      expect(download).toMatchObject({
        actor_id: hrId,
        actor_role: 'HR_MANAGER',
      });
      await request(ctx.server)
        .get(`/applications/${appId}/cv`)
        .set(bearer(t.interviewer))
        .expect(404);
      expect(
        (await names(appId)).filter((e) => e === 'APPLICATION_CV_DOWNLOADED'),
      ).toHaveLength(1);
    });
  });

  describe('offers', () => {
    it('records an offer being made, edited and accepted, with the move it caused in the same transaction', async () => {
      const appId = await flow.toOfferStage(jobId);
      const offerUrl = `/applications/${appId}/offer`;

      await flow.post(t.recruiter, offerUrl, flow.offerBody()).expect(201);
      const offerId = (
        await ctx.maintenance.query<{ id: string }[]>(
          `SELECT id FROM offers WHERE application_id = $1`,
          [appId],
        )
      )[0].id;
      await request(ctx.server)
        .patch(offerUrl)
        .set(bearer(t.recruiter))
        .send({ salary: 25000000 })
        .expect(200);
      await request(ctx.server)
        .patch(offerUrl)
        .set(bearer(t.recruiter))
        .send({ salary: 25000000 })
        .expect(200);
      await flow
        .post(t.recruiter, `${offerUrl}/response`, { accepted: true })
        .expect(200);

      const offerEvents = await trail(offerId);
      expect(offerEvents.map((e) => e.event)).toEqual([
        'OFFER_CREATED',
        'OFFER_UPDATED',
        'OFFER_RESPONSE_RECORDED',
      ]);
      expect(offerEvents[1].data).toEqual({ changedFields: ['salary'] });
      expect(offerEvents[2].data).toEqual({ response: 'ACCEPTED' });
      expect(offerEvents.every((e) => e.entity_type === 'Offer')).toBe(true);

      // The response and the hire share one transaction.
      const hired = (await trail(appId)).at(-1)!;
      expect(hired).toMatchObject({ event: 'APPLICATION_STATUS_CHANGED' });
      expect(hired.data).toMatchObject({ from: 'OFFER', to: 'HIRED' });
      expect(hired.tx_id).toBe(offerEvents[2].tx_id);
      const tables = (await rowChanges(ctx, hired)).map((c) => c.table_name);
      expect(tables).toEqual(
        expect.arrayContaining([
          'offers',
          'applications',
          'application_status_histories',
        ]),
      );
    });

    it('records a declined offer as the offer and the withdrawal that follows', async () => {
      const appId = await flow.toOfferStage(jobId);
      const offerUrl = `/applications/${appId}/offer`;
      await flow.post(t.recruiter, offerUrl, flow.offerBody()).expect(201);

      await flow
        .post(t.recruiter, `${offerUrl}/response`, { accepted: false })
        .expect(200);

      const last = (await trail(appId)).at(-1)!;
      expect(last.data).toMatchObject({ from: 'OFFER', to: 'WITHDRAWN' });
      const offerRow = (await rowChanges(ctx, last)).find(
        (c) => c.table_name === 'offers',
      );
      expect(offerRow?.changes).toEqual({ status: ['PENDING', 'DECLINED'] });
    });

    it('records nothing for a second answer or an offer in the wrong stage', async () => {
      const appId = await flow.toOfferStage(jobId);
      const offerUrl = `/applications/${appId}/offer`;
      await flow.post(t.recruiter, offerUrl, flow.offerBody()).expect(201);
      await flow
        .post(t.recruiter, `${offerUrl}/response`, { accepted: true })
        .expect(200);
      const before = (await trail(appId)).length;

      await flow
        .post(t.recruiter, `${offerUrl}/response`, { accepted: false })
        .expect(409);
      const other = await flow.application(jobId);
      await flow
        .post(t.recruiter, `/applications/${other}/offer`, flow.offerBody())
        .expect(409);

      expect((await trail(appId)).length).toBe(before);
      expect((await trail(other)).map((e) => e.event)).toEqual([
        'APPLICATION_CREATED',
      ]);
    });
  });
});
