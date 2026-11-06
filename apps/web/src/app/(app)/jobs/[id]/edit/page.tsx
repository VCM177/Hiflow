import { EditJobPage } from '@/features/jobs/job-form-pages';

export default async function EditJobRoute({
  params,
}: PageProps<'/jobs/[id]/edit'>) {
  const { id } = await params;
  return <EditJobPage id={id} />;
}
