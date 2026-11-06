import { redirect } from 'next/navigation';

// Each report has its own address so a tab can be shared.
export default function ReportsIndexPage() {
  redirect('/reports/requisition-progress');
}
