import { JobDetail } from '@/features/jobs/job-detail';

export default async function JobRoute({ params }: PageProps<'/jobs/[id]'>) {
  const { id } = await params;
  return <JobDetail id={id} />;
}
