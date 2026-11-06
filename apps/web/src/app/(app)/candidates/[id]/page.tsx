import { CandidateDetail } from '@/features/candidates/candidate-detail';

export default async function CandidateRoute({
  params,
}: PageProps<'/candidates/[id]'>) {
  const { id } = await params;
  return <CandidateDetail id={id} />;
}
