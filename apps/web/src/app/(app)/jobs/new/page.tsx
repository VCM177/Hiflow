import { NewJobPage } from '@/features/jobs/job-form-pages';

export default async function NewJobRoute({
  searchParams,
}: PageProps<'/jobs/new'>) {
  const { requisitionId } = await searchParams;
  return (
    <NewJobPage
      requisitionId={
        Array.isArray(requisitionId) ? requisitionId[0] : requisitionId
      }
    />
  );
}
