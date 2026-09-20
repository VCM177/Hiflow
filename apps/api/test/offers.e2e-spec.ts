import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

interface Offer {
  id: string;
  applicationId: string;
  salary: number;
  startDate: string;
  expiresAt: string | null;
  status: string;
  note: string | null;
  createdBy: { name: string } | null;
}
interface App {
  status: string;
  history: {
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
  }[];
  offer: { status: string } | null;
}

const DAY_MS = 86_400_000;
const dayFromNow = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);

describe('Offers (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;

  const offerUrl = (appId: string) => `/applications/${appId}/offer`;
  const get = (token: string, path: string) =>
    request(ctx.server).get(path).set(bearer(token));
  const create = (appId: string, body: object, token = () => t.recruiter) =>
    request(ctx.server).post(offerUrl(appId)).set(bearer(token())).send(body);
  const update = (appId: string, body: object, token = () => t.recruiter) =>
    request(ctx.server).patch(offerUrl(appId)).set(bearer(token())).send(body);
  const respond = (appId: string, body: object, token = () => t.recruiter) =>
    request(ctx.server)
      .post(`${offerUrl(appId)}/response`)
      .set(bearer(token()))
      .send(body);
  const application = async (appId: string) =>
    (await get(t.recruiter, `/applications/${appId}`).expect(200)).body as App;

  /** An application at the OFFER stage with a pending offer already made. */
  const withOffer = async (body: object = {}) => {
    const appId = await flow.toOfferStage(jobId);
    const offer = (await create(appId, flow.offerBody(body)).expect(201))
      .body as Offer;
    return { appId, offer };
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-OFR');
    await flow.cleanup();
    jobId = await flow.openJob();
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  describe('access', () => {
    it('requires authentication', async () => {
      const appId = await flow.toOfferStage(jobId);
      await request(ctx.server).get(offerUrl(appId)).expect(401);
    });

    it('hides offers from roles without offer permissions', async () => {
      const { appId } = await withOffer();

      for (const token of [t.hr, t.manager, t.interviewer]) {
        await get(token, offerUrl(appId)).expect(403);
        await create(appId, flow.offerBody(), () => token).expect(403);
        await update(appId, { salary: 1 }, () => token).expect(403);
        await respond(appId, { accepted: true }, () => token).expect(403);
      }
    });
  });

  describe('making an offer', () => {
    it('creates a pending offer that can be read back', async () => {
      const appId = await flow.toOfferStage(jobId);
      const body = flow.offerBody({
        salary: 25000000,
        note: 'Thử việc 2 tháng',
      });

      const offer = (await create(appId, body).expect(201)).body as Offer;

      expect(offer).toMatchObject({
        applicationId: appId,
        salary: 25000000,
        startDate: body.startDate,
        expiresAt: body.expiresAt,
        status: 'PENDING',
        note: 'Thử việc 2 tháng',
      });
      expect(offer.createdBy?.name).toBe('Nguyễn Ngọc Lan');

      const read = (await get(t.recruiter, offerUrl(appId)).expect(200))
        .body as Offer;
      expect(read.id).toBe(offer.id);
    });

    it('works without a response deadline', async () => {
      const appId = await flow.toOfferStage(jobId);
      const body = flow.offerBody();
      delete (body as { expiresAt?: string }).expiresAt;

      expect(
        ((await create(appId, body).expect(201)).body as Offer).expiresAt,
      ).toBeNull();
    });

    it('has no offer to read before one is made', async () => {
      const appId = await flow.toOfferStage(jobId);
      await get(t.recruiter, offerUrl(appId)).expect(404);
    });

    it('only allows an offer for an application in the offer stage', async () => {
      const appId = await flow.toInterviewStage(jobId);

      const response = await create(appId, flow.offerBody()).expect(409);
      expect((response.body as { message: string }).message).toMatch(/Đề nghị/);
    });

    it('404s for an unknown application and 400s for a malformed id', async () => {
      await create(
        '00000000-0000-4000-8000-000000000000',
        flow.offerBody(),
      ).expect(404);
      await request(ctx.server)
        .get('/applications/nope/offer')
        .set(bearer(t.recruiter))
        .expect(400);
    });

    it('allows only one offer per application', async () => {
      const { appId } = await withOffer();

      const dup = await create(appId, flow.offerBody()).expect(409);
      expect((dup.body as { message: string }).message).toMatch(
        /đã có đề nghị/,
      );
    });

    it.each([
      ['a zero salary', { salary: 0 }],
      ['a negative salary', { salary: -5 }],
      ['a fractional salary', { salary: 1.5 }],
      ['a text salary', { salary: 'nhiều' }],
      ['an absurd salary', { salary: 99_999_999_999 }],
      ['a missing salary', { salary: undefined }],
      ['a start date in the past', { startDate: dayFromNow(-1) }],
      ['a malformed start date', { startDate: 'soon' }],
      ['a deadline in the past', { expiresAt: dayFromNow(-1) }],
      ['a deadline after the start date', { expiresAt: dayFromNow(60) }],
      ['a note that is too long', { note: 'x'.repeat(2001) }],
      ['an unexpected field', { status: 'ACCEPTED' }],
    ])('rejects %s', async (_label, override) => {
      const appId = await flow.toOfferStage(jobId);
      await create(appId, flow.offerBody(override)).expect(400);
    });
  });

  describe('editing an offer', () => {
    it('changes the terms while the offer is pending', async () => {
      const { appId } = await withOffer();

      const updated = (
        await update(appId, {
          salary: 30000000,
          note: 'Đã thương lượng',
        }).expect(200)
      ).body as Offer;

      expect(updated).toMatchObject({
        salary: 30000000,
        note: 'Đã thương lượng',
        status: 'PENDING',
      });
    });

    it('validates the dates against the values already stored', async () => {
      const { appId } = await withOffer({
        startDate: dayFromNow(40),
        expiresAt: dayFromNow(20),
      });

      // Moving the start earlier than the stored deadline is caught without resending it.
      await update(appId, { startDate: dayFromNow(10) }).expect(400);
      await update(appId, { startDate: dayFromNow(-2) }).expect(400);
      await update(appId, { startDate: dayFromNow(25) }).expect(200);
    });

    it('is frozen once the candidate has answered', async () => {
      const { appId } = await withOffer();
      await respond(appId, { accepted: true }).expect(200);

      await update(appId, { salary: 1 }).expect(409);
    });
  });

  describe('the candidate’s answer', () => {
    it('accepting hires the candidate and records it on the application', async () => {
      const { appId } = await withOffer();

      const offer = (await respond(appId, { accepted: true }).expect(200))
        .body as Offer;
      expect(offer.status).toBe('ACCEPTED');

      const app = await application(appId);
      expect(app.status).toBe('HIRED');
      expect(app.offer?.status).toBe('ACCEPTED');
      expect(app.history.at(-1)).toMatchObject({
        fromStatus: 'OFFER',
        toStatus: 'HIRED',
        note: 'Ứng viên chấp nhận đề nghị',
      });
    });

    it('declining marks the candidate as withdrawn and keeps their words', async () => {
      const { appId } = await withOffer();

      const offer = (
        await respond(appId, {
          accepted: false,
          note: 'Nhận được đề nghị tốt hơn',
        }).expect(200)
      ).body as Offer;
      expect(offer.status).toBe('DECLINED');

      const app = await application(appId);
      expect(app.status).toBe('WITHDRAWN');
      expect(app.history.at(-1)).toMatchObject({
        toStatus: 'WITHDRAWN',
        note: 'Nhận được đề nghị tốt hơn',
      });
    });

    it('cannot be answered twice', async () => {
      const { appId } = await withOffer();
      await respond(appId, { accepted: true }).expect(200);

      const again = await respond(appId, { accepted: false }).expect(409);
      expect((again.body as { message: string }).message).toMatch(
        /đã được phản hồi/,
      );
      expect((await application(appId)).status).toBe('HIRED');
    });

    it('refuses to accept an expired offer but still lets it be declined', async () => {
      const expired = await withOffer();
      const declined = await withOffer();
      for (const { offer } of [expired, declined]) {
        await ctx.dataSource.query(
          `UPDATE offers SET expires_at = current_date - 1 WHERE id = $1`,
          [offer.id],
        );
      }

      const refused = await respond(expired.appId, { accepted: true }).expect(
        409,
      );
      expect((refused.body as { message: string }).message).toMatch(/hết hạn/);
      expect((await application(expired.appId)).status).toBe('OFFER');

      await respond(declined.appId, { accepted: false }).expect(200);
      expect((await application(declined.appId)).status).toBe('WITHDRAWN');
    });

    it.each([
      ['a missing answer', {}],
      ['a text answer', { accepted: 'yes' }],
      ['an unexpected field', { accepted: true, status: 'HIRED' }],
    ])('rejects %s', async (_label, body) => {
      const { appId } = await withOffer();
      await respond(appId, body).expect(400);
    });

    it('lets an admin record the answer too', async () => {
      const { appId } = await withOffer();
      await respond(appId, { accepted: true }, () => t.admin).expect(200);
    });

    it('is refused once the application was rejected, because its offer was declined with it', async () => {
      const { appId } = await withOffer();
      await flow
        .move(appId, 'REJECTED', 'Thay đổi kế hoạch tuyển dụng')
        .expect(200);

      expect(
        ((await get(t.recruiter, offerUrl(appId)).expect(200)).body as Offer)
          .status,
      ).toBe('DECLINED');
      await respond(appId, { accepted: true }).expect(409);
      expect((await application(appId)).status).toBe('REJECTED');
    });

    it('keeps offer and application consistent when two answers race', async () => {
      const { appId } = await withOffer();

      const outcomes = await Promise.all([
        respond(appId, { accepted: true }),
        respond(appId, { accepted: false }),
      ]);
      expect(outcomes.map((r) => r.status).sort()).toEqual([200, 409]);

      const offer = (await get(t.recruiter, offerUrl(appId)).expect(200))
        .body as Offer;
      const app = await application(appId);
      const expected = offer.status === 'ACCEPTED' ? 'HIRED' : 'WITHDRAWN';

      expect(app.status).toBe(expected);
      expect(app.history.filter((h) => h.toStatus === expected)).toHaveLength(
        1,
      );
    });
  });

  describe('audit trail', () => {
    it('records offer writes against the application they belong to', async () => {
      const { appId } = await withOffer();
      await respond(appId, { accepted: true }).expect(200);

      let routes: string[] = [];
      for (let i = 0; i < 40 && routes.length < 3; i++) {
        const rows: { payload: { route: string } }[] =
          await ctx.dataSource.query(
            `SELECT payload FROM activity_logs WHERE entity_type = 'Application' AND entity_id = $1`,
            [appId],
          );
        routes = rows
          .map((r) => r.payload.route)
          .filter((r) => r.includes('/offer'));
        if (routes.length < 2) await new Promise((r) => setTimeout(r, 50));
      }

      expect(routes).toEqual(
        expect.arrayContaining([
          '/applications/:id/offer',
          '/applications/:id/offer/response',
        ]),
      );
    });
  });
});
