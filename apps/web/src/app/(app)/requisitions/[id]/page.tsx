import { RequisitionDetail } from '@/features/requisitions/requisition-detail';

export default async function RequisitionRoute({
  params,
}: PageProps<'/requisitions/[id]'>) {
  const { id } = await params;
  return <RequisitionDetail id={id} />;
}
