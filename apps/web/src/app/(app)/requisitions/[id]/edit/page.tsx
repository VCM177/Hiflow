import { EditRequisitionPage } from '@/features/requisitions/requisition-form-pages';

export default async function EditRequisitionRoute({
  params,
}: PageProps<'/requisitions/[id]/edit'>) {
  const { id } = await params;
  return <EditRequisitionPage id={id} />;
}
