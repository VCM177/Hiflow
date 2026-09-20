/** Only requests that change data are recorded; reads would flood the log. */
export const LOGGED_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

/** Route patterns never recorded (a login body carries a password). */
export const SKIP_LOG_ROUTES: readonly string[] = ['/auth/login'];

/** Maps the first URL segment to the entity name shown in the log. */
export const ENTITY_TYPE_BY_RESOURCE: Readonly<Record<string, string>> = {
  users: 'User',
  departments: 'Department',
  positions: 'JobPosition',
  requisitions: 'Requisition',
  jobs: 'Job',
  candidates: 'Candidate',
  applications: 'Application',
  offers: 'Offer',
  interviews: 'Interview',
};
