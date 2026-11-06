import { AuditDetail } from '@/features/audit/audit-detail';

export default async function AuditEventRoute({
  params,
}: PageProps<'/audit-events/[id]'>) {
  const { id } = await params;
  return <AuditDetail id={id} />;
}
