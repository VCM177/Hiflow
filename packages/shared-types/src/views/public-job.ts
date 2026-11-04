/**
 * What a stranger may see of a job. Everything here is written for candidates:
 * no creator, requisition code, application count, internal ids or status.
 * Add a field only after asking whether it is meant for the public.
 */
export interface PublicJobView {
  id: string;
  title: string;
  department: string | null;
  position: string | null;
  location: string | null;
  /** Written by staff as rich text: the web app must sanitise it before rendering. */
  description: string | null;
  quantity: number;
  salaryMin: number | null;
  salaryMax: number | null;
  publishedAt: Date | null;
}
