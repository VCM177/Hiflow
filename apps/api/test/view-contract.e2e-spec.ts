import type {
  ApplicationDetail,
  ApplicationListItem,
  AuditEventDetail,
  AuthUser,
  CandidateDetailView,
  DashboardOverview,
  InterviewView,
  JobView,
  OfferView,
  PublicJobView,
  Report,
  RequisitionEvent,
  RequisitionView,
  UserOption,
  UserView,
} from '@hiflow/shared-types';
import request from 'supertest';
import { bearer, createE2eApp, E2eContext } from './helpers/e2e-app';
import { createFlow, FlowTokens, loginAll } from './helpers/flow';

/**
 * The views live in @hiflow/shared-types and the web app trusts them. This
 * checks the real responses against them, so a field added to a mapper but not
 * to the shared type (or the reverse) fails here instead of in the browser.
 *
 * Each key list is written as `Record<keyof View, true>`: the compiler rejects
 * a list that misses a key of the type or names one it does not have, and the
 * test then requires the response to carry exactly those keys.
 */
const keysOf = <T>(shape: Record<keyof T, true>): string[] =>
  Object.keys(shape).sort();

const REQUISITION = keysOf<RequisitionView>({
  id: true,
  code: true,
  title: true,
  department: true,
  position: true,
  quantity: true,
  reason: true,
  expectedStartDate: true,
  budgetMin: true,
  budgetMax: true,
  status: true,
  createdBy: true,
  approvedBy: true,
  approvedAt: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
});

const REQUISITION_EVENT = keysOf<RequisitionEvent>({
  id: true,
  event: true,
  actor: true,
  note: true,
  at: true,
});

const JOB = keysOf<JobView>({
  id: true,
  requisition: true,
  title: true,
  position: true,
  department: true,
  quantity: true,
  salaryMin: true,
  salaryMax: true,
  location: true,
  description: true,
  status: true,
  publishedAt: true,
  createdBy: true,
  applicationCount: true,
  createdAt: true,
  updatedAt: true,
});

const PUBLIC_JOB = keysOf<PublicJobView>({
  id: true,
  title: true,
  department: true,
  position: true,
  location: true,
  description: true,
  quantity: true,
  salaryMin: true,
  salaryMax: true,
  publishedAt: true,
});

const CANDIDATE_DETAIL = keysOf<CandidateDetailView>({
  id: true,
  fullName: true,
  email: true,
  phone: true,
  dob: true,
  source: true,
  hasCv: true,
  note: true,
  anonymizedAt: true,
  createdAt: true,
  updatedAt: true,
  applications: true,
});

const APPLICATION_LIST_ITEM = keysOf<ApplicationListItem>({
  id: true,
  candidate: true,
  job: true,
  status: true,
  appliedAt: true,
  assignee: true,
});

const APPLICATION_DETAIL = keysOf<ApplicationDetail>({
  id: true,
  candidate: true,
  job: true,
  status: true,
  appliedAt: true,
  assignee: true,
  note: true,
  hasCv: true,
  candidateDetail: true,
  history: true,
  interviews: true,
  offer: true,
});

const INTERVIEW = keysOf<InterviewView>({
  id: true,
  application: true,
  round: true,
  scheduledAt: true,
  interviewer: true,
  result: true,
  feedback: true,
  createdAt: true,
  updatedAt: true,
});

const OFFER = keysOf<OfferView>({
  id: true,
  applicationId: true,
  salary: true,
  startDate: true,
  expiresAt: true,
  status: true,
  note: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

const USER = keysOf<UserView>({
  id: true,
  email: true,
  fullName: true,
  role: true,
  departmentId: true,
  departmentName: true,
  isActive: true,
  createdAt: true,
});

const USER_OPTION = keysOf<UserOption>({
  id: true,
  fullName: true,
  role: true,
});

const AUDIT_EVENT_DETAIL = keysOf<AuditEventDetail>({
  id: true,
  occurredAt: true,
  event: true,
  label: true,
  entityType: true,
  entityId: true,
  actor: true,
  txId: true,
  requestId: true,
  origin: true,
  ip: true,
  userAgent: true,
  data: true,
  rowChanges: true,
});

const DASHBOARD = keysOf<DashboardOverview>({
  period: true,
  cards: true,
  funnel: true,
  outcomes: true,
  todo: true,
});

const DASHBOARD_CARDS = keysOf<DashboardOverview['cards']>({
  pendingRequisitions: true,
  openJobs: true,
  newApplications: true,
  upcomingInterviews: true,
  hiredInPeriod: true,
});

const REPORT = keysOf<Report>({
  type: true,
  title: true,
  period: true,
  columns: true,
  rows: true,
});

const AUTH_USER = keysOf<AuthUser>({
  id: true,
  email: true,
  fullName: true,
  role: true,
  departmentId: true,
  permissions: true,
});

const keysIn = (body: unknown): string[] =>
  Object.keys(body as Record<string, unknown>).sort();

/** A `Date` field arrives as an ISO string (that is what `Jsonified` promises). */
const isIsoDate = (value: unknown): boolean =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

describe('View contract (e2e)', () => {
  let ctx: E2eContext;
  let t: FlowTokens;
  let flow: ReturnType<typeof createFlow>;
  let jobId: string;
  let candidateId: string;
  let appId: string;
  let requisitionId: string;

  const get = async (
    token: string,
    path: string,
  ): Promise<{ body: unknown }> => {
    const res = await request(ctx.server)
      .get(path)
      .set(bearer(token))
      .expect(200);
    return { body: res.body as unknown };
  };

  beforeAll(async () => {
    ctx = await createE2eApp();
    t = await loginAll(ctx);
    flow = createFlow(ctx, t, 'E2E-VIEWS');
    await flow.cleanup();

    jobId = await flow.openJob();
    const candidate = await flow.candidate('views');
    candidateId = candidate.id;
    appId = await flow.toOfferStage(jobId);
    await flow
      .post(t.recruiter, `/applications/${appId}/offer`, flow.offerBody())
      .expect(201);

    const job = (await get(t.admin, `/jobs/${jobId}`)).body as JobView;
    requisitionId = job.requisition?.id ?? '';
  });

  afterAll(async () => {
    await flow.cleanup();
    await ctx.app.close();
  });

  it('requisition and its history', async () => {
    const view = (await get(t.admin, `/requisitions/${requisitionId}`)).body;
    expect(keysIn(view)).toEqual(REQUISITION);
    expect(isIsoDate((view as RequisitionView).createdAt)).toBe(true);

    const history = (
      await get(t.admin, `/requisitions/${requisitionId}/history`)
    ).body as unknown[];
    expect(history.length).toBeGreaterThan(0);
    for (const event of history)
      expect(keysIn(event)).toEqual(REQUISITION_EVENT);
  });

  it('job, in staff and public form', async () => {
    const job = (await get(t.admin, `/jobs/${jobId}`)).body as JobView;
    expect(keysIn(job)).toEqual(JOB);
    expect(isIsoDate(job.publishedAt)).toBe(true);

    const pub = (await get(t.admin, `/public/jobs/${jobId}`)).body;
    expect(keysIn(pub)).toEqual(PUBLIC_JOB);
  });

  it('candidate, application and its list item', async () => {
    const candidate = (await get(t.admin, `/candidates/${candidateId}`)).body;
    expect(keysIn(candidate)).toEqual(CANDIDATE_DETAIL);

    const application = (await get(t.admin, `/applications/${appId}`)).body;
    expect(keysIn(application)).toEqual(APPLICATION_DETAIL);

    const list = (await get(t.admin, `/applications?jobId=${jobId}&limit=5`))
      .body as { items: unknown[] };
    expect(list.items.length).toBeGreaterThan(0);
    for (const item of list.items) {
      expect(keysIn(item)).toEqual(APPLICATION_LIST_ITEM);
    }
  });

  it('interview and offer', async () => {
    const application = (await get(t.admin, `/applications/${appId}`))
      .body as ApplicationDetail;
    const interviewId = application.interviews[0].id;

    const interview = (await get(t.admin, `/interviews/${interviewId}`)).body;
    expect(keysIn(interview)).toEqual(INTERVIEW);

    const offer = (await get(t.admin, `/applications/${appId}/offer`)).body;
    expect(keysIn(offer)).toEqual(OFFER);
  });

  it('user, user option and the signed-in user', async () => {
    const me = (await get(t.admin, '/auth/me')).body as AuthUser;
    expect(keysIn(me)).toEqual(AUTH_USER);

    const user = (await get(t.admin, `/users/${me.id}`)).body;
    expect(keysIn(user)).toEqual(USER);

    const options = (await get(t.recruiter, '/users/options')).body as {
      items: unknown[];
    };
    expect(options.items.length).toBeGreaterThan(0);
    for (const option of options.items) {
      expect(keysIn(option)).toEqual(USER_OPTION);
    }
  });

  it('audit event with its row changes', async () => {
    const list = (await get(t.admin, '/audit-events?limit=1')).body as {
      items: { id: string }[];
    };
    expect(list.items.length).toBeGreaterThan(0);

    const detail = (await get(t.admin, `/audit-events/${list.items[0].id}`))
      .body;
    expect(keysIn(detail)).toEqual(AUDIT_EVENT_DETAIL);
  });

  it('dashboard overview and a report', async () => {
    const overview = (await get(t.admin, '/dashboard/overview'))
      .body as DashboardOverview;
    expect(keysIn(overview)).toEqual(DASHBOARD);
    expect(keysIn(overview.cards)).toEqual(DASHBOARD_CARDS);

    const report = (await get(t.admin, '/reports/job-results')).body;
    expect(keysIn(report)).toEqual(REPORT);
  });
});
