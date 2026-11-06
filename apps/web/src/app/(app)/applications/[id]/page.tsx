import { ApplicationDetail } from '@/features/applications/application-detail';

export default async function ApplicationRoute({
  params,
}: PageProps<'/applications/[id]'>) {
  const { id } = await params;
  return <ApplicationDetail id={id} />;
}
