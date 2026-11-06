import { redirect } from 'next/navigation';

// The menu points at /catalogs; each catalogue has its own address so a tab can be shared.
export default function CatalogsIndexPage() {
  redirect('/catalogs/department');
}
