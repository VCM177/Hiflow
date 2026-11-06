import { InterviewDetail } from '@/features/interviews/interview-detail';

export default async function InterviewRoute({
  params,
}: PageProps<'/interviews/[id]'>) {
  const { id } = await params;
  return <InterviewDetail id={id} />;
}
