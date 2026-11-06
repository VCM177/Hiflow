import { notFound } from 'next/navigation';

import { CatalogsPage } from '@/features/catalogs/catalogs-page';
import { isCatalogKind } from '@/features/catalogs/constants';

export default async function CatalogKindPage({
  params,
}: PageProps<'/catalogs/[kind]'>) {
  const { kind } = await params;
  if (!isCatalogKind(kind)) notFound();
  // `key` gives each catalogue its own state: switching tab starts clean.
  return <CatalogsPage key={kind} kind={kind} />;
}
