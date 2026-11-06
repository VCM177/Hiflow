import { notFound } from 'next/navigation';

import { isReportType } from '@/features/reports/constants';
import { ReportsPage } from '@/features/reports/reports-page';

export default async function ReportRoute({
  params,
}: PageProps<'/reports/[type]'>) {
  const { type } = await params;
  if (!isReportType(type)) notFound();
  return <ReportsPage key={type} type={type} />;
}
